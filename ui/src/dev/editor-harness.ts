/**
 * 本地开发用的编辑器集成测试入口。
 *
 * 这个文件不会被插件入口 `src/index.ts` 引用，因此不会进入最终产物。
 *
 * ⚠ 上一版的测试页有个致命问题：它在 HTML 里**手写了一份 `.modal-wrapper` 的 CSS**，
 * 于是「弹窗显示正常」的结论完全是这页自己造出来的假象，
 * 真实 Halo 控制台里的问题一个都测不出来。
 *
 * 这一版改成**集成测试**：
 *
 * - 加载 Halo 真实的 `@halo-dev/richtext-editor`（真正的 Tiptap 编辑器）；
 * - 注册一个和 Halo `custom-attachment-extension` **完全一致**的
 *   `openAttachmentSelector` 命令桩；
 * - 走插件真实的工具箱回调 → 命令 → 回调这条链路，
 *   最后断言文档里真的出现了 `threeModel` 节点。
 *
 * 也就是说：这里验证的是**插件与 Halo 之间的契约**，
 * 而不是插件自己造出来的假界面。
 */
import {
  Editor,
  Extension,
  ExtensionDocument,
  ExtensionParagraph,
  ExtensionText,
  RichTextEditor,
} from "@halo-dev/richtext-editor";
import { createApp, h } from "vue";
import ThreeModel from "@/tiptap/three-model-extension";

export interface HarnessAttachment {
  spec?: { displayName?: string; mediaType?: string };
  status?: { permalink?: string };
}

interface SelectorCall {
  callback: (attachments: HarnessAttachment[]) => void;
  options?: { accepts?: string[]; min?: number; max?: number };
}

/** 记录每一次对附件选择器的调用 */
const selectorCalls: SelectorCall[] = [];

/**
 * 和 Halo 的 `custom-attachment-extension` 一样的命令桩。
 *
 * Halo 源码：`ui/src/components/editor/DefaultEditor.vue`
 * ```ts
 * addCommands() {
 *   return {
 *     openAttachmentSelector: (callback, options) => () => {
 *       if (options) attachmentOptions.value = options;
 *       attachmentSelectorModal.value = true;
 *       attachmentResult.updateAttachment = (attachments) => callback(attachments);
 *       return true;
 *     },
 *   };
 * }
 * ```
 */
const HarnessAttachmentSelector = Extension.create({
  name: "harnessAttachmentSelector",
  addCommands() {
    return {
      openAttachmentSelector:
        (callback: (attachments: HarnessAttachment[]) => void, options?: unknown) =>
        () => {
          selectorCalls.push({
            callback,
            options: options as SelectorCall["options"],
          });
          return true;
        },
    } as never;
  },
});

const editor = new Editor({
  extensions: [
    ExtensionDocument,
    ExtensionParagraph,
    ExtensionText,
    ThreeModel,
    HarnessAttachmentSelector,
  ],
  content: "<p></p>",
});

/**
 * 用 Halo 自己的 `RichTextEditor` 组件把编辑器挂上去。
 *
 * ⚠ 这一点很关键：Halo 控制台里编辑器是**在 Vue 组件树内**的
 * （`DefaultEditor.vue` → `<RichTextEditor :editor="editor" />`），
 * 节点视图依赖组件树里 provide 下来的上下文。
 * 如果直接 `new Editor({ element })` 挂到裸 DOM 上，节点视图就会缺上下文、渲染不完整。
 */
const mountTarget = document.getElementById("editor");
if (mountTarget) {
  createApp({
    render() {
      return h(RichTextEditor, { editor });
    },
  }).mount(mountTarget);
}

/** 取到插件的 Tiptap 扩展实例 */
function getExtension(): any {
  return editor.extensionManager.extensions.find(
    (extension) => extension.name === "threeModel"
  );
}

/** 触发工具箱里的「3D 模型」按钮 */
function triggerToolboxInsert(): void {
  const extension = getExtension();
  const items = extension.options.getToolboxItems({ editor });
  const list = Array.isArray(items) ? items : [items];
  const item = list[0];
  item.props.action();
}

/** 取气泡菜单的按钮列表 */
function getBubbleMenuItems(): any[] {
  const extension = getExtension();
  return extension.options.getBubbleMenu({ editor }).items ?? [];
}

/**
 * 把「设置」按钮返回的组件真正渲染出来。
 *
 * Halo 的 `BubbleItem` 拿到组件后会渲染在气泡菜单的下拉层里，
 * 这里用同样的方式挂一个实例出来，检查面板控件是否齐全。
 */
function renderSettingsPanel(): HTMLElement {
  const items = getBubbleMenuItems();
  const settingsItem = items.find((item) => item.props?.title === "设置");
  if (!settingsItem) {
    throw new Error("气泡菜单里没有「设置」按钮");
  }

  const component = settingsItem.props.action({ editor });
  const host = document.createElement("div");
  host.id = "settings-panel-host";
  document.body.appendChild(host);

  createApp({
    render() {
      return h(component as any, { editor });
    },
  }).mount(host);

  return host;
}

/** 模拟用户在 Halo 的附件选择器里选中了一个文件 */
function selectAttachment(attachment: HarnessAttachment): void {
  const call = selectorCalls[selectorCalls.length - 1];
  if (!call) {
    throw new Error("附件选择器还没被调用过");
  }
  call.callback([attachment]);
}

/** 取出文档里所有 3D 模型节点的属性 */
function getModelNodes(): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "threeModel") {
      nodes.push({ ...node.attrs });
    }
    return true;
  });
  return nodes;
}

/** 选中第 n 个 3D 模型节点 */
function selectModelNode(index = 0): boolean {
  let pos = -1;
  let count = 0;
  editor.state.doc.descendants((node, nodePos) => {
    if (node.type.name === "threeModel") {
      if (count === index) {
        pos = nodePos;
        return false;
      }
      count += 1;
    }
    return true;
  });
  if (pos < 0) return false;
  return editor.commands.setNodeSelection(pos);
}

/** 等一等，让 await 链上的微任务跑完 */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

declare global {
  interface Window {
    Halo3DHarness?: {
      editor: Editor;
      selectorCalls: SelectorCall[];
      triggerToolboxInsert: () => void;
      getBubbleMenuItems: () => any[];
      selectAttachment: (attachment: HarnessAttachment) => void;
      getModelNodes: () => Record<string, unknown>[];
      selectModelNode: (index?: number) => boolean;
      renderSettingsPanel: () => HTMLElement;
      flush: () => Promise<void>;
    };
  }
}

window.Halo3DHarness = {
  editor,
  selectorCalls,
  triggerToolboxInsert,
  getBubbleMenuItems,
  selectAttachment,
  getModelNodes,
  selectModelNode,
  renderSettingsPanel,
  flush,
};
