import type { EditorLike } from "@/utils/editor-type";

/** 3D 模型节点的类型名 */
export const THREE_MODEL_NODE_NAME = "threeModel";

/**
 * 在文档里找到某个 3D 模型节点的位置。
 *
 * 「插入模型 → 再补选材质」这类场景里，弹出附件选择器后编辑器选区可能已经
 * 变了，`updateAttributes` 就会作用到错误的节点上。
 * 所以这里按 `src` 反查节点位置，再显式选中最准确的那个节点。
 *
 * @returns 节点在文档中的位置；找不到时返回 `undefined`
 */
export function findThreeModelPos(
  editor: EditorLike,
  src: string
): number | undefined {
  if (!src) return undefined;

  let found: number | undefined;

  editor.state.doc.descendants((node, pos) => {
    if (found !== undefined) return false;
    if (
      node.type.name === THREE_MODEL_NODE_NAME &&
      node.attrs.src === src
    ) {
      found = pos;
      return false;
    }
    return true;
  });

  return found;
}

/**
 * 选中指定的 3D 模型节点。
 *
 * @returns 是否成功选中
 */
export function selectThreeModel(editor: EditorLike, pos: number): boolean {
  try {
    return editor.commands.setNodeSelection(pos);
  } catch (error) {
    console.error("[halo-plugin-3d] 选中 3D 模型节点失败", error);
    return false;
  }
}

/**
 * 找到并选中某个 3D 模型节点。
 */
export function focusThreeModel(editor: EditorLike, src: string): boolean {
  const pos = findThreeModelPos(editor, src);
  if (pos === undefined) return false;
  return selectThreeModel(editor, pos);
}
