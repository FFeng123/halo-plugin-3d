import { injectStyles } from "./styles";
import { detectColorScheme, watchColorScheme } from "./theme";
import { ThreeModelViewer, type ViewerOptions } from "./viewer";

interface Registry {
  instances: Map<HTMLElement, ThreeModelViewer>;
  stopWatching?: () => void;
}

/**
 * 运行时状态存放在全局对象上。
 *
 * 同一篇文章中可能出现多个 3D 模型，每个模型都会引入一次运行时脚本，
 * 此时必须复用同一个注册表，否则已经挂载的视图会失去引用。
 */
const GLOBAL_KEY = "__HALO_3D_RUNTIME__";
const globalScope = window as unknown as Record<string, unknown>;
const registry: Registry =
  (globalScope[GLOBAL_KEY] as Registry) ||
  (globalScope[GLOBAL_KEY] = { instances: new Map() });

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

/** 自动初始化页面上所有带 `data-halo-3d-model` 的容器 */
function autoInit(root: ParentNode = document): void {
  injectStyles();
  const elements = Array.from(
    root.querySelectorAll<HTMLElement>("[data-halo-3d-model]")
  );
  elements.forEach((el) => {
    if (!registry.instances.has(el)) {
      mount(el);
    }
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => autoInit(), {
      once: true,
    });
  } else {
    autoInit();
  }
  // 站点可能在运行时就切换主题，这里做一次兜底检测
  detectColorScheme();
}

export default {
  mount,
  unmount,
  autoInit,
  version: "1.0.0",
};
