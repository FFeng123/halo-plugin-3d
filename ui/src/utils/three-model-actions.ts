import { Toast } from "@halo-dev/components";
import {
  MATERIAL_EXTENSIONS,
  MODEL_EXTENSIONS,
  DEFAULT_HEIGHT,
} from "@/constants";
import {
  MATERIAL_ACCEPTS,
  MODEL_ACCEPTS,
  pickAttachment,
  type PickedAttachment,
} from "@/utils/attachment-selector";
import {
  focusThreeModel,
  THREE_MODEL_NODE_NAME,
} from "@/utils/three-model-node";
import type { EditorLike } from "@/utils/editor-type";

const NODE_NAME = THREE_MODEL_NODE_NAME;

const MODEL_LABEL = MODEL_EXTENSIONS.map((ext) => `.${ext}`).join(" / ");
const MATERIAL_LABEL = MATERIAL_EXTENSIONS.map((ext) => `.${ext}`).join(" / ");

/**
 * 追加材质文件。
 *
 * OBJ 可以搭配 MTL 材质。这里在模型插入之后再问一次，用户可以跳过（点取消）。
 *
 * ⚠ Halo 的附件选择器**只在「确认选择」时回调**，点「取消」不会回调。
 * 所以这里刻意不 await 它的结果：用户不选材质时 Promise 一直挂着，
 * 不会阻塞任何后续流程（模型节点已经插进去了）。
 */
function attachMaterial(editor: EditorLike, modelSrc: string): void {
  void pickAttachment(editor, {
    accepts: MATERIAL_ACCEPTS,
    extensions: MATERIAL_EXTENSIONS,
    label: MATERIAL_LABEL,
  })
    .then((material: PickedAttachment | undefined) => {
      if (!material) return;
      // 选材质期间选区可能变了，先按 src 把模型节点重新选中
      if (!focusThreeModel(editor, modelSrc)) {
        console.error("[halo-plugin-3d] 找不到要设置材质的模型节点", modelSrc);
        return;
      }
      editor
        .chain()
        .updateAttributes(NODE_NAME, { mtlSrc: material.url })
        .run();
    })
    .catch((error) => {
      console.error("[halo-plugin-3d] 选择材质失败", error);
    });
}

/**
 * 插入一个 3D 模型节点。
 *
 * 附件选择复用 **Halo 自带的附件选择器**（全局编辑器命令
 * `openAttachmentSelector`），插件不再自己造弹窗。
 */
export async function insertThreeModel(editor: EditorLike): Promise<void> {
  try {
    const attachment = await pickAttachment(editor, {
      accepts: MODEL_ACCEPTS,
      extensions: MODEL_EXTENSIONS,
      label: MODEL_LABEL,
    });
    if (!attachment) return;

    editor
      .chain()
      .focus()
      .insertContent({
        type: NODE_NAME,
        attrs: {
          src: attachment.url,
          mtlSrc: "",
          name: attachment.name,
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

    // OBJ 可以再补一个 MTL 材质
    if (attachment.name.toLowerCase().endsWith(".obj")) {
      attachMaterial(editor, attachment.url);
    }
  } catch (error) {
    console.error("[halo-plugin-3d] 插入 3D 模型失败", error);
    Toast.error("插入 3D 模型失败，请打开浏览器控制台查看详细错误");
  }
}

/** 替换当前选中的 3D 模型节点里的模型文件 */
export async function replaceThreeModel(editor: EditorLike): Promise<void> {
  try {
    const attachment = await pickAttachment(editor, {
      accepts: MODEL_ACCEPTS,
      extensions: MODEL_EXTENSIONS,
      label: MODEL_LABEL,
    });
    if (!attachment) return;

    editor
      .chain()
      .focus()
      .updateAttributes(NODE_NAME, {
        src: attachment.url,
        mtlSrc: "",
        name: attachment.name,
      })
      .run();

    if (attachment.name.toLowerCase().endsWith(".obj")) {
      attachMaterial(editor, attachment.url);
    }
  } catch (error) {
    console.error("[halo-plugin-3d] 更换 3D 模型失败", error);
    Toast.error("更换 3D 模型失败，请查看浏览器控制台");
  }
}
