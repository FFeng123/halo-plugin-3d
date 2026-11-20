import { definePlugin } from "@halo-dev/console-shared";
import ThreeModel from "@/tiptap/three-model-extension";

/**
 * Halo 3D 模型插件。
 *
 * 通过 `default:editor:extension:create` 扩展点向默认编辑器注入
 * 3D 模型节点，实现「从附件中选择模型 → 插入文章 → Three.js 渲染」。
 */
export default definePlugin({
  extensionPoints: {
    "default:editor:extension:create": () => {
      return [ThreeModel];
    },
  },
});
