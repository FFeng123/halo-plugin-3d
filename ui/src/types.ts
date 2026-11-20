/** 3D 区块的主题模式 */
export type ThreeModelTheme = "auto" | "light" | "dark";

/** 3D 区块的背景样式 */
export type ThreeModelBackground = "none" | "solid" | "gradient";

/**
 * 3D 模型节点在文章中保存的属性。
 *
 * 这些属性会同时写入文章的 HTML（`data-*`），
 * 公开站点的运行时据此还原渲染参数。
 */
export interface ThreeModelAttributes {
  /** 模型文件地址（附件 permalink） */
  src: string;
  /** 材质文件地址（OBJ 搭配 MTL 时使用） */
  mtlSrc: string;
  /** 模型文件名，用于展示 */
  name: string;
  /** 展示宽度 */
  width: string;
  /** 展示高度 */
  height: string;
  /** 亮色 / 暗色 / 跟随站点 */
  theme: ThreeModelTheme;
  /** 是否自动旋转 */
  autoRotate: boolean;
  /** 背景样式 */
  background: ThreeModelBackground;
  /** 是否显示地面网格 */
  grid: boolean;
  /** 是否允许鼠标交互（旋转 / 缩放） */
  controls: boolean;
}

/** 运行时（window.Halo3D）的渲染参数 */
export interface Halo3DViewerOptions {
  src: string;
  mtlSrc?: string;
  name?: string;
  width?: string;
  height?: string;
  theme?: ThreeModelTheme;
  autoRotate?: boolean;
  background?: ThreeModelBackground;
  grid?: boolean;
  controls?: boolean;
}

/** 公开站点运行时的对外接口 */
export interface Halo3DRuntime {
  /** 在容器上挂载一个 3D 视图 */
  mount(el: HTMLElement, options?: Partial<Halo3DViewerOptions>): void;
  /** 卸载容器上的 3D 视图 */
  unmount(el: HTMLElement): void;
  /** 自动初始化页面上所有带 `data-halo-3d-model` 的容器 */
  autoInit(root?: ParentNode): void;
  /** 运行时版本 */
  version: string;
}

declare global {
  interface Window {
    Halo3D?: Halo3DRuntime;
  }
}
