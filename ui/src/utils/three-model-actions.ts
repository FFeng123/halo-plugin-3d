import type { EditorLike } from "@/utils/editor-type";
import { DEFAULT_HEIGHT } from "@/constants";
import { THREE_MODEL_NODE_NAME } from "@/utils/three-model-node";
import type { ThreeModelAttributes } from "@/types";

/**
 * 插入一个空的 3D 模型节点。
 *
 * ⚠ 这里是**同步插入**，不打开任何弹窗、不等待任何异步结果。
 *
 * 原因来自 Halo 官方文档与官方示例插件：
 *
 * - 文档里 `ExtensionOptions` 只公开 toolbar / commandMenu / bubbleMenu /
 *   toolbox / draggable 这 5 个扩展点，**没有**"打开附件选择器"的公开 API；
 * - 官方示例插件 `plugin-text-diagram` 的工具箱按钮也是
 *   **直接同步 `insertContent`**，把后续交互放在节点视图内部实现。
 *
 * 之前的实现是"点击 → await 附件选择器 → 再插入节点"，
 * 一旦选择器因为任何原因没渲染出来，用户看到的就是**完全没有任何反应**。
 * 现在改成"点击 → 立刻插入节点 → 在节点里选文件"，
 * 点击必定有可见结果，选择器的问题也就不再阻塞主流程了。
 */
export function insertThreeModel(editor: EditorLike): void {
  try {
    editor
      .chain()
      .focus()
      .insertContent({
        type: THREE_MODEL_NODE_NAME,
        attrs: {
          src: "",
          mtlSrc: "",
          name: "",
          width: "100%",
          height: DEFAULT_HEIGHT,
          theme: "auto",
          autoRotate: true,
          background: "solid",
          grid: true,
          controls: true,
        },
      })
      .run();
  } catch (error) {
    console.error("[halo-plugin-3d] 插入 3D 模型节点失败", error);
  }
}

/** 给某个节点写入模型文件 */
export function applyModel(
  update: (patch: Partial<ThreeModelAttributes>) => void,
  model: { url: string; name: string }
): void {
  update({
    src: model.url,
    name: model.name,
    // 换了模型文件，旧材质一定不适用
    mtlSrc: "",
  });
}

/** 给某个节点写入材质文件 */
export function applyMaterial(
  update: (patch: Partial<ThreeModelAttributes>) => void,
  material: { url: string }
): void {
  update({ mtlSrc: material.url });
}
