import { defineComponent, h } from "vue";

interface IconChild {
  tag: string;
  attrs: Record<string, unknown>;
}

/**
 * 创建一个线性图标组件。
 *
 * 图标会被编辑器渲染成 `h-5 w-5` / `h-7 w-7` 的尺寸，
 * 因此统一使用 `currentColor` 描边并铺满父容器。
 */
function createIcon(name: string, children: IconChild[]) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs }) {
      return () =>
        h(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": 1.7,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "aria-hidden": "true",
            ...attrs,
          },
          children.map((child) => h(child.tag, child.attrs))
        );
    },
  });
}

/** 立方体：3D 模型 */
export const CubeIcon = createIcon("CubeIcon", [
  { tag: "path", attrs: { d: "M12 2.6 20.5 7v10L12 21.4 3.5 17V7L12 2.6Z" } },
  { tag: "path", attrs: { d: "M3.5 7 12 11.4 20.5 7" } },
  { tag: "path", attrs: { d: "M12 11.4v10" } },
]);

/** 交换：更换模型 */
export const SwapIcon = createIcon("SwapIcon", [
  { tag: "path", attrs: { d: "M4 8.5h13.5" } },
  { tag: "path", attrs: { d: "m14.5 5.5 3 3-3 3" } },
  { tag: "path", attrs: { d: "M20 15.5H6.5" } },
  { tag: "path", attrs: { d: "m9.5 12.5-3 3 3 3" } },
]);

/** 主题：亮色 / 暗色 */
export const ThemeIcon = createIcon("ThemeIcon", [
  { tag: "path", attrs: { d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" } },
  {
    tag: "path",
    attrs: {
      d: "M12 3v18a9 9 0 0 0 0-18Z",
      fill: "currentColor",
      stroke: "none",
    },
  },
]);

/** 自动旋转 */
export const RotateIcon = createIcon("RotateIcon", [
  { tag: "path", attrs: { d: "M20 12a8 8 0 1 1-2.4-5.7" } },
  { tag: "path", attrs: { d: "M20.2 4.2v4.4h-4.4" } },
]);

/** 网格背景 */
export const GridIcon = createIcon("GridIcon", [
  { tag: "path", attrs: { d: "M4 4h7v7H4z" } },
  { tag: "path", attrs: { d: "M13 4h7v7h-7z" } },
  { tag: "path", attrs: { d: "M4 13h7v7H4z" } },
  { tag: "path", attrs: { d: "M13 13h7v7h-7z" } },
]);

/** 高度 */
export const HeightIcon = createIcon("HeightIcon", [
  { tag: "path", attrs: { d: "M12 3v18" } },
  { tag: "path", attrs: { d: "m8 7 4-4 4 4" } },
  { tag: "path", attrs: { d: "m8 17 4 4 4-4" } },
]);

/** 设置：调节杆 */
export const SettingsIcon = createIcon("SettingsIcon", [
  { tag: "path", attrs: { d: "M4 7h10" } },
  { tag: "path", attrs: { d: "M18 7h2" } },
  { tag: "path", attrs: { d: "M4 17h4" } },
  { tag: "path", attrs: { d: "M12 17h8" } },
  { tag: "path", attrs: { d: "M16 4v6" } },
  { tag: "path", attrs: { d: "M10 14v6" } },
]);

/** 拖动：四向箭头 */
export const MoveIcon = createIcon("MoveIcon", [
  { tag: "path", attrs: { d: "M12 3v18" } },
  { tag: "path", attrs: { d: "M3 12h18" } },
  { tag: "path", attrs: { d: "m9.5 5.5 2.5-2.5 2.5 2.5" } },
  { tag: "path", attrs: { d: "m9.5 18.5 2.5 2.5 2.5-2.5" } },
  { tag: "path", attrs: { d: "m5.5 9.5-2.5 2.5 2.5 2.5" } },
  { tag: "path", attrs: { d: "m18.5 9.5 2.5 2.5-2.5 2.5" } },
]);

/** 删除 */
export const TrashIcon = createIcon("TrashIcon", [
  { tag: "path", attrs: { d: "M4 7h16" } },
  { tag: "path", attrs: { d: "M9.5 7V4.8h5V7" } },
  { tag: "path", attrs: { d: "m6.5 7 1 13h9l1-13" } },
  { tag: "path", attrs: { d: "M10.5 11v5.5" } },
  { tag: "path", attrs: { d: "M13.5 11v5.5" } },
]);
