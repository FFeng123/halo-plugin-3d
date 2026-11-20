import type { NodeViewProps } from "@halo-dev/richtext-editor";

/**
 * 插件内部统一使用的编辑器类型。
 *
 * Halo 的编辑器包里有两种 Editor：
 *
 * - `ExtensionOptions`（工具箱 / 气泡菜单回调）用的是 `@tiptap/vue-3` 的 Editor；
 * - 节点视图 `NodeViewProps.editor` 用的是 `@tiptap/core` 的 Editor。
 *
 * 后者是前者的**基类**，所以这里统一按基类来写，
 * 工具函数在两个地方都能直接用，不需要任何强制转换。
 */
export type EditorLike = NodeViewProps["editor"];
