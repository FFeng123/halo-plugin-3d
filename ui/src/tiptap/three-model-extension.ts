import {
  BlockActionSeparator,
  Node,
  ToolboxItem,
  deleteNode,
  isActive,
  mergeAttributes,
  VueNodeViewRenderer,
  type Editor,
  type ExtensionOptions,
  type NodeBubbleMenuType,
  type Range,
} from "@halo-dev/richtext-editor";
import { markRaw } from "vue";
import {
  CubeIcon,
  GridIcon,
  HeightIcon,
  MoveIcon,
  RotateIcon,
  SettingsIcon,
  ThemeIcon,
  TrashIcon,
} from "@/components/icons";
import ThreeModelNodeView from "@/components/ThreeModelNodeView.vue";
import ThreeModelSettingsPanel from "@/components/ThreeModelSettingsPanel.vue";
import { DEFAULT_HEIGHT, HEIGHT_PRESETS, RUNTIME_SCRIPT_URL } from "@/constants";
import type { ThreeModelAttributes } from "@/types";
import { insertThreeModel } from "@/utils/three-model-actions";
import { THREE_MODEL_NODE_NAME } from "@/utils/three-model-node";

const NODE_NAME = THREE_MODEL_NODE_NAME;

const THEME_LABELS: Record<ThreeModelAttributes["theme"], string> = {
  auto: "跟随站点",
  light: "亮色",
  dark: "暗色",
};

function currentAttributes(editor: Editor): ThreeModelAttributes {
  return editor.getAttributes(NODE_NAME) as ThreeModelAttributes;
}

/**
 * 解析背景样式。
 *
 * 早期版本用 `data-background="grid"` 同时表达「网格」和「背景」，
 * 这里把它统一转换成「纯色背景 + 显示网格」。
 */
function parseBackground(
  value: string | null
): ThreeModelAttributes["background"] {
  if (value === "none" || value === "transparent") return "none";
  if (value === "gradient") return "gradient";
  return "solid";
}

/**
 * 解析网格开关。
 *
 * 新内容带有 `data-grid` 时直接采用；
 * 旧内容没有该属性，此时沿用旧语义：只有背景为 `grid` 时才显示网格。
 */
function parseGrid(
  value: string | null,
  legacyBackground: string | null
): boolean {
  if (value !== null) return value !== "false";
  return legacyBackground === "grid";
}

/**
 * 插入一个 3D 模型节点。
 *
 * 整个流程包在 try/catch 里：任何一步抛错都会给出明确的提示，
 * 避免出现「点了没反应、也没报错」这种最难排查的情况。
 */
function updateAttributes(
  editor: Editor,
  attributes: Partial<ThreeModelAttributes>
): void {
  editor.chain().focus().updateAttributes(NODE_NAME, attributes).run();
}

/**
 * 未加载模型时显示的占位元素（带内联样式）。
 *
 * 为什么要有它：
 *
 * 文章里保存的是一段静态 HTML，里面引用了插件的运行时脚本
 * （`/plugins/PluginThreeD/assets/console/halo-3d-runtime.js`）。
 * 一旦**卸载插件**，这段脚本就 404 了，模型容器会变成一个空荡荡的
 * 固定高度（默认 420px）的大框——读者看到的是一片空白。
 *
 * 这个占位元素直接写进 HTML 且样式全部内联，因此不依赖插件的任何样式表：
 * 插件在 → 运行时挂载成功后被移除；插件不在 → 一直显示为一个带模型名的提示框。
 */
function buildFallback(name: string) {
  return [
    "div",
    {
      class: "halo-3d-fallback",
      style:
        "display:flex;align-items:center;justify-content:center;flex-direction:column;" +
        "gap:6px;width:100%;height:100%;min-height:120px;box-sizing:border-box;padding:16px;" +
        "text-align:center;color:#9ca3af;font-size:14px;line-height:1.7;" +
        "background:#f9fafb;border:1px dashed #d1d5db;border-radius:8px;",
    },
    [
      "span",
      { style: "font-weight:600;color:#6b7280;" },
      name ? `3D 模型：${name}` : "3D 模型",
    ],
    [
      "span",
      { style: "font-size:12px;" },
      "（若长时间显示此提示，请确认已安装并启用 3D 模型插件）",
    ],
  ];
}

/**
 * 3D 模型节点扩展。
 *
 * - 工具箱 / 斜杠命令：从附件中选择模型后插入；
 * - 悬浮菜单：更换模型、打开设置面板、切换亮暗主题、自动旋转、网格、拖动、展示高度、删除；
 * - 序列化：输出带 `data-*` 属性的 `div`，公开站点的运行时据此渲染。
 *
 * 附件选择完全复用 **Halo 自带的附件选择器**
 * （全局编辑器命令 `openAttachmentSelector`），插件不再自己造弹窗。
 */
const ThreeModel = Node.create<ExtensionOptions>({
  name: NODE_NAME,

  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  defining: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-src") || "",
        renderHTML: (attributes) => ({ "data-src": attributes.src }),
      },
      mtlSrc: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-mtl-src") || "",
        renderHTML: (attributes) => ({ "data-mtl-src": attributes.mtlSrc }),
      },
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-name") || "",
        renderHTML: (attributes) => ({ "data-name": attributes.name }),
      },
      width: {
        default: "100%",
        parseHTML: (element) => element.getAttribute("data-width") || "100%",
        renderHTML: (attributes) => ({ "data-width": attributes.width }),
      },
      height: {
        default: DEFAULT_HEIGHT,
        parseHTML: (element) =>
          element.getAttribute("data-height") || DEFAULT_HEIGHT,
        renderHTML: (attributes) => ({ "data-height": attributes.height }),
      },
      theme: {
        default: "auto",
        parseHTML: (element) =>
          (element.getAttribute("data-theme") as ThreeModelAttributes["theme"]) ||
          "auto",
        renderHTML: (attributes) => ({ "data-theme": attributes.theme }),
      },
      autoRotate: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-autorotate") !== "false",
        renderHTML: (attributes) => ({
          "data-autorotate": String(attributes.autoRotate),
        }),
      },
      background: {
        default: "solid",
        parseHTML: (element) => parseBackground(element.getAttribute("data-background")),
        renderHTML: (attributes) => ({
          "data-background": attributes.background,
        }),
      },
      grid: {
        default: true,
        parseHTML: (element) =>
          parseGrid(
            element.getAttribute("data-grid"),
            element.getAttribute("data-background")
          ),
        renderHTML: (attributes) => ({
          "data-grid": String(attributes.grid),
        }),
      },
      controls: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-controls") !== "false",
        renderHTML: (attributes) => ({
          "data-controls": String(attributes.controls),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-halo-3d-model]",
      },
    ];
  },

  renderHTML({ node }) {
    const attributes = node.attrs as ThreeModelAttributes;
    return [
      "div",
      mergeAttributes({
        class: "halo-3d-model",
        "data-halo-3d-model": "true",
        "data-src": attributes.src,
        "data-mtl-src": attributes.mtlSrc,
        "data-name": attributes.name,
        "data-width": attributes.width,
        "data-height": attributes.height,
        "data-theme": attributes.theme,
        "data-autorotate": String(attributes.autoRotate),
        "data-background": attributes.background,
        "data-grid": String(attributes.grid),
        "data-controls": String(attributes.controls),
        style: `position:relative;display:block;width:${attributes.width};height:${attributes.height};overflow:hidden;margin:1rem auto;`,
      }),
      // ⚠ ProseMirror 的 DOMOutputSpec 里，子元素必须**平铺**在属性对象之后，
      // 也就是 `["div", attrs, child1, child2]`。
      // 如果再套一层数组写成 `["div", attrs, [child1, child2]]`，
      // renderSpec 会拿到一个「数组的数组」，直接抛
      // `RangeError: Invalid array passed to renderSpec` —— 表现就是文章根本保存不了。
      // 占位元素：插件未启用 / 未安装时也能给出可读提示，而不是一片空白
      buildFallback(attributes.name),
      [
        "script",
        {
          src: RUNTIME_SCRIPT_URL,
          defer: "defer",
          "data-halo-3d-runtime": "true",
        },
      ],
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(ThreeModelNodeView);
  },

  addOptions() {
    return {
      // 官方文档要求合并父级 options
      ...this.parent?.(),
      getToolboxItems({ editor }: { editor: Editor }) {
        return [
          {
            priority: 45,
            component: markRaw(ToolboxItem),
            props: {
              editor,
              icon: markRaw(CubeIcon),
              title: "3D 模型",
              description: "插入 OBJ / FBX / GLB 模型",
              // 同步插入节点：点击后立刻出现「选择模型文件」面板，
              // 不依赖任何弹窗，因此点击必定有可见结果。
              action: () => {
                insertThreeModel(editor);
              },
            },
          },
        ];
      },

      getCommandMenuItems() {
        return [
          {
            priority: 110,
            icon: markRaw(CubeIcon),
            title: "3D 模型",
            keywords: ["3d", "3D", "模型", "cube", "three", "obj", "fbx", "glb"],
            command: ({ editor, range }: { editor: Editor; range: Range }) => {
              editor.chain().focus().deleteRange(range).run();
              insertThreeModel(editor);
            },
          },
        ];
      },

      getBubbleMenu({ editor }: { editor: Editor }): NodeBubbleMenuType {
        return {
          pluginKey: "threeModelBubbleMenu",
          shouldShow: ({ state }) => isActive(state, NODE_NAME),
          items: [
            {
              priority: 20,
              props: {
                icon: markRaw(SettingsIcon),
                title: "设置",
                // ⚠ Halo 的 BubbleItem 支持 action 返回一个组件，
                // 返回后组件会渲染在气泡菜单的下拉层里（见 Halo 源码
                // ui/packages/editor/src/components/bubble/BubbleItem.vue）。
                // 这里用它承载完整的设置面板，**不需要任何弹窗**。
                action: () => markRaw(ThreeModelSettingsPanel),
              },
            },
            {
              priority: 30,
              props: {
                icon: markRaw(ThemeIcon),
                title: `主题：${THEME_LABELS[currentAttributes(editor).theme]}`,
                action: () => {
                  const order: ThreeModelAttributes["theme"][] = [
                    "auto",
                    "light",
                    "dark",
                  ];
                  const current = currentAttributes(editor).theme;
                  const next = order[(order.indexOf(current) + 1) % order.length];
                  updateAttributes(editor, { theme: next });
                },
              },
            },
            {
              priority: 40,
              props: {
                icon: markRaw(RotateIcon),
                title: currentAttributes(editor).autoRotate
                  ? "停止自动旋转"
                  : "开启自动旋转",
                isActive: () => currentAttributes(editor).autoRotate,
                action: () => {
                  updateAttributes(editor, {
                    autoRotate: !currentAttributes(editor).autoRotate,
                  });
                },
              },
            },
            {
              priority: 50,
              props: {
                icon: markRaw(GridIcon),
                title: currentAttributes(editor).grid ? "隐藏网格" : "显示网格",
                isActive: () => currentAttributes(editor).grid,
                action: () => {
                  updateAttributes(editor, {
                    grid: !currentAttributes(editor).grid,
                  });
                },
              },
            },
            {
              priority: 60,
              props: {
                icon: markRaw(MoveIcon),
                title: currentAttributes(editor).controls
                  ? "禁止手动拖动"
                  : "允许手动拖动",
                isActive: () => currentAttributes(editor).controls,
                action: () => {
                  updateAttributes(editor, {
                    controls: !currentAttributes(editor).controls,
                  });
                },
              },
            },
            {
              priority: 70,
              props: {
                icon: markRaw(HeightIcon),
                title: `高度：${currentAttributes(editor).height}`,
                action: () => {
                  const current = currentAttributes(editor).height;
                  const index = HEIGHT_PRESETS.indexOf(current);
                  const next =
                    HEIGHT_PRESETS[
                      (index + 1 + HEIGHT_PRESETS.length) % HEIGHT_PRESETS.length
                    ];
                  updateAttributes(editor, { height: next });
                },
              },
            },
            {
              priority: 80,
              component: markRaw(BlockActionSeparator),
            },
            {
              priority: 90,
              props: {
                icon: markRaw(TrashIcon),
                title: "删除",
                action: () => {
                  deleteNode(NODE_NAME, editor);
                },
              },
            },
          ],
        };
      },
    };
  },
});

export default ThreeModel;
