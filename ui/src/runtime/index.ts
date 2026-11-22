import { injectStyles } from "./styles";
import { detectColorScheme, watchColorScheme } from "./theme";
import { ThreeModelViewer, type ViewerOptions } from "./viewer";

/**
 * 运行时 API 挂载到的全局变量名。
 *
 * ⚠ 这个键同时是「幂等守卫」：
 * 构建时会在 IIFE 函数体最前面插入一段守卫代码（见 `vite.runtime.config.ts` 的
 * `output.intro`），一旦发现该全局变量已存在，就**直接返回已有 API**，
 * 整个函数体（包括内联的 three.js）根本不会执行第二次。
 *
 * 这样一来，同一篇文章里插入 N 个模型时，文章中 N 个 `<script>`
 * 只会有第一个真正执行，three.js 不会被重复实例化。
 */
const API_KEY = "__HALO_3D_RUNTIME__";

/** 运行时内部状态（实例表、DOM 监听器）挂载到的全局变量名 */
const STATE_KEY = "__HALO_3D_STATE__";

/**
 * 未加载模型时显示的占位元素。
 *
 * 它被直接写进文章保存的 HTML 里（带内联样式），因此**卸载插件后依然存在**，
 * 读者看到的是一个带模型名的占位框，而不是一个空荡荡的 420px 黑框。
 */
const FALLBACK_SELECTOR = ".halo-3d-fallback";

interface Registry {
  instances: Map<HTMLElement, ThreeModelViewer>;
  stopWatching?: () => void;
  observer?: MutationObserver;
  scheduled?: number | null;
}

const globalScope = window as unknown as Record<string, unknown>;

/**
 * 运行时状态放在全局对象上。
 *
 * 正常情况下只会执行一次（见 `API_KEY` 的说明），
 * 这里仍然做一次兜底，避免极端情况下（比如脚本被重复注入）丢失已挂载的视图。
 */
const registry: Registry =
  (globalScope[STATE_KEY] as Registry) ||
  (globalScope[STATE_KEY] = { instances: new Map() });

/**
 * 当前正在执行的 script 元素。
 *
 * 初始化完成后会用它把文章里其余重复的 `<script data-halo-3d-runtime>` 清理掉，
 * 让「运行时只加载一次」在 DOM 上也看得见。
 */
const currentScript = (document.currentScript as HTMLScriptElement | null) ?? null;

function readOptions(el: HTMLElement): Required<ViewerOptions> {
  const data = el.dataset;
  const legacyBackground = data.background;
  return {
    src: data.src || "",
    mtlSrc: data.mtlSrc || "",
    name: data.name || "",
    width: data.width || "100%",
    height: data.height || "420px",
    theme: (data.theme as ViewerOptions["theme"]) || "auto",
    autoRotate: data.autorotate !== "false",
    background: readBackground(legacyBackground),
    grid: readGrid(data.grid, legacyBackground),
    controls: data.controls !== "false",
  };
}

/**
 * 读取背景样式。
 *
 * 早期版本把「网格」和「背景」混在 `data-background` 里（取值 `none|grid|gradient`），
 * 这里兼容该写法：`grid` 等价于纯色背景。
 */
function readBackground(
  value?: string
): NonNullable<ViewerOptions["background"]> {
  if (value === "none" || value === "transparent") return "none";
  if (value === "gradient") return "gradient";
  return "solid";
}

/**
 * 读取网格开关。
 *
 * 新内容带有 `data-grid` 时直接采用；旧内容没有该属性，
 * 此时沿用旧语义：只有背景为 `grid` 时才显示网格。
 */
function readGrid(value: string | undefined, legacyBackground?: string): boolean {
  if (value !== undefined) return value !== "false";
  return legacyBackground === "grid";
}

function ensureWatching(): void {
  if (registry.stopWatching) return;
  registry.stopWatching = watchColorScheme((scheme) => {
    registry.instances.forEach((viewer) => viewer.applyScheme(scheme));
  });
}

/** 移除容器里的占位元素（模型挂载成功后就不需要它了） */
function removeFallback(el: HTMLElement): void {
  el.querySelectorAll(FALLBACK_SELECTOR).forEach((node) => node.remove());
}

/** 在容器上挂载一个 3D 视图 */
function mount(
  el: HTMLElement,
  options?: Partial<ViewerOptions>
): void {
  injectStyles();

  const merged = { ...readOptions(el), ...(options || {}) };

  // 没有模型地址时什么都不做。
  // 编辑器里插入节点后是可以先不选文件的，这种空节点如果被保存进文章，
  // 不应该在公开站点上显示「不支持的模型格式」这种错误提示。
  if (!merged.src) {
    unmount(el);
    return;
  }

  // 占位元素必须在创建画布之前移除，
  // 否则画布会被挤到占位元素下面（容器是固定高度 + overflow:hidden）。
  removeFallback(el);

  const existing = registry.instances.get(el);
  if (existing) {
    existing.update(merged);
    return;
  }

  const viewer = new ThreeModelViewer(el, merged);
  registry.instances.set(el, viewer);
  ensureWatching();
  void viewer.load();
}

/** 卸载容器上的 3D 视图 */
function unmount(el: HTMLElement): void {
  const viewer = registry.instances.get(el);
  if (!viewer) return;
  viewer.destroy();
  registry.instances.delete(el);
}

/** 挂载所有还没有被挂载过的模型容器 */
function mountPending(root: ParentNode = document): void {
  const elements = Array.from(
    root.querySelectorAll<HTMLElement>("[data-halo-3d-model]")
  );
  elements.forEach((el) => {
    if (!registry.instances.has(el)) {
      mount(el);
    }
  });
}

/** 自动初始化页面上所有带 `data-halo-3d-model` 的容器 */
function autoInit(root: ParentNode = document): void {
  injectStyles();
  mountPending(root);
}

/**
 * 监听 DOM 变化，自动挂载**后插入**的模型容器。
 *
 * 运行时只初始化一次之后，页面里新出现的模型块（例如主题做了局部刷新、
 * 或者文章内容被前端框架重新渲染）就没有脚本会再触发一次初始化，
 * 这里用 MutationObserver 补上这块。
 */
function scheduleScan(): void {
  if (registry.scheduled !== undefined && registry.scheduled !== null) return;
  const run = () => {
    // 先把标记清掉：即使下面的挂载过程抛异常，也不能让标记一直挂着，
    // 否则之后的每一次扫描都会被当成「已经在排队」而直接跳过。
    registry.scheduled = null;
    try {
      mountPending();
    } catch (error) {
      console.error("[halo-3d] 扫描模型容器失败", error);
    }
  };
  // 这里刻意用 setTimeout 而不是 requestAnimationFrame：
  // 浏览器把标签页切到后台时会暂停 rAF 回调，那样动态插入的模型块就永远挂不上，
  // 而且 `registry.scheduled` 会一直挂着，后续扫描全部被跳过。
  registry.scheduled = window.setTimeout(run, 50) as unknown as number;
}

function ensureObserver(): void {
  if (registry.observer) return;
  if (typeof MutationObserver === "undefined" || !document.body) return;
  const observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.body, { childList: true, subtree: true });
  registry.observer = observer;
}

/**
 * 清理文章里重复的运行时脚本标签。
 *
 * 一篇文章插入多个模型时，保存下来的 HTML 里会有多个
 * `<script data-halo-3d-runtime>`。虽然有幂等守卫保证它们不会重复执行，
 * 但留着这些标签没有意义，删掉之后 DOM 里就只剩一个运行时入口。
 */
function removeDuplicateRuntimeScripts(): void {
  const scripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>("script[data-halo-3d-runtime]")
  );
  scripts.forEach((script) => {
    if (script !== currentScript) {
      script.remove();
    }
  });
}

function init(): void {
  autoInit();
  ensureObserver();
  removeDuplicateRuntimeScripts();
}

const api = {
  mount,
  unmount,
  autoInit,
  version: "1.4.0",
};

/**
 * 暴露到全局，供构建时插入的幂等守卫复用：
 * 第二次执行脚本时守卫会直接 `return window.__HALO_3D_RUNTIME__`，
 * 既不会重新实例化 three.js，也不会把 `window.Halo3D` 覆盖成 undefined。
 *
 * ⚠ 这一句必须放在 `init()` **之前**：
 * 万一初始化过程抛异常，守卫也要已经装好，
 * 否则第二次执行脚本会把整个 bundle（连同 three.js）再跑一遍。
 */
globalScope[API_KEY] = api;

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
  // 站点可能在运行时就切换主题，这里做一次兜底检测
  detectColorScheme();
}

export default api;
