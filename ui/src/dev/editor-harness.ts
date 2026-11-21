/**
 * 本地开发用的编辑器集成测试入口。
 *
 * 这个文件不会被插件入口 `src/index.ts` 引用，因此不会进入最终产物。
 *
 * 测试目标：**点击工具箱后，节点是否真的插入了，并且内联的「选择模型文件」
 * 面板是否渲染出来了。**
 *
 * 这里刻意不走任何弹窗，所以测试也不需要给弹窗打任何桩——
 * 面板是节点视图的一部分，能渲染节点视图就一定能看到面板。
 */
import {
  Editor,
  ExtensionDocument,
  ExtensionParagraph,
  ExtensionText,
  RichTextEditor,
} from "@halo-dev/richtext-editor";
import { createApp, h } from "vue";
import ThreeModel from "@/tiptap/three-model-extension";

export interface HarnessAttachment {
  spec?: { displayName?: string; mediaType?: string; size?: number };
  status?: { permalink?: string };
}

/** 测试用的附件数据（模拟 Halo 附件库） */
const MOCK_ATTACHMENTS: HarnessAttachment[] = [
  {
    spec: { displayName: "cube.obj", mediaType: "application/octet-stream", size: 802 },
    status: { permalink: "/fixtures/cube.obj" },
  },
  {
    spec: { displayName: "cube.mtl", mediaType: "application/octet-stream", size: 188 },
    status: { permalink: "/fixtures/cube.mtl" },
  },
  {
    spec: { displayName: "photo.png", mediaType: "image/png", size: 4096 },
    status: { permalink: "/fixtures/photo.png" },
  },
];

/** 记录附件接口被调用的情况 */
const apiCalls: { method: string; params: unknown }[] = [];

const editor = new Editor({
  extensions: [
    ExtensionDocument,
    ExtensionParagraph,
    ExtensionText,
    ThreeModel,
  ],
  content: "<p></p>",
});

/**
 * 用 Halo 自己的 `RichTextEditor` 组件把编辑器挂上去。
 *
 * ⚠ 这一点很关键：Halo 控制台里编辑器是**在 Vue 组件树内**的
 * （`DefaultEditor.vue` → `<RichTextEditor :editor="editor" />`），
 * 节点视图依赖组件树里 provide 下来的上下文。
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
  list[0].props.action();
}

/** 取气泡菜单的按钮列表 */
function getBubbleMenuItems(): any[] {
  const extension = getExtension();
  return extension.options.getBubbleMenu({ editor }).items ?? [];
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
function flush(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiCalls() {
  return apiCalls;
}

declare global {
  interface Window {
    Halo3DHarness?: {
      editor: Editor;
      mockAttachments: HarnessAttachment[];
      apiCalls: typeof apiCalls;
      triggerToolboxInsert: () => void;
      getBubbleMenuItems: () => any[];
      getModelNodes: () => Record<string, unknown>[];
      selectModelNode: (index?: number) => boolean;
      getApiCalls: typeof getApiCalls;
      flush: typeof flush;
    };
  }
}

window.Halo3DHarness = {
  editor,
  mockAttachments: MOCK_ATTACHMENTS,
  apiCalls,
  triggerToolboxInsert,
  getBubbleMenuItems,
  getModelNodes,
  selectModelNode,
  getApiCalls,
  flush,
};
