/**
 * 插件 ID，必须与 `src/main/resources/plugin.yaml` 中的 `metadata.name` 一致。
 *
 * 该名称同时是控制台中 `window.<PLUGIN_NAME>` 的全局变量名，
 * 因此必须是合法的 JavaScript 标识符（不能包含短横线）。
 */
export const PLUGIN_NAME = "PluginThreeD";

/**
 * 公开站点运行时的地址。
 *
 * Halo 会把插件 classpath 下的 `console/` 目录映射到
 * `/plugins/{插件名}/assets/console/`，因此文章中可以直接引用该脚本。
 */
export const RUNTIME_SCRIPT_URL = `/plugins/${PLUGIN_NAME}/assets/console/halo-3d-runtime.js`;

/** 支持的模型文件扩展名 */
export const MODEL_EXTENSIONS = ["glb", "gltf", "fbx", "obj"];

/** 支持的材质文件扩展名 */
export const MATERIAL_EXTENSIONS = ["mtl"];

/** 可选的展示高度 */
export const HEIGHT_PRESETS = ["320px", "420px", "560px", "680px"];

/** 可选的展示宽度 */
export const WIDTH_PRESETS = ["100%", "640px", "800px", "1000px"];

/** 默认展示高度 */
export const DEFAULT_HEIGHT = "420px";
