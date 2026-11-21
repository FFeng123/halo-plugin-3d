/**
 * 生成 Halo 插件 logo.svg（512x512 满幅方图，遵循官方插件 logo 规范）：
 *  - 满幅渐变底 + 左上径向高光
 *  - 白色等轴测线框立方体 + 面内网格 + 顶点节点
 *  - 两圈淡色轨道环
 *
 * 用法：node scripts/gen-logo.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/main/resources/logo.svg");

const n = (v) => Math.round(v * 100) / 100;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const pt = (p) => `${n(p[0])} ${n(p[1])}`;

/* ---------- 等轴测立方体几何 ---------- */
// 顶面菱形四角：T(顶点) R(右上) C(前上) L(左上)
const T = [256, 118];
const R = [400, 202];
const C = [256, 286];
const L = [112, 202];
// 竖直棱下端
const BL = [112, 366];
const BR = [400, 366];
const B = [256, 450];

/** 在平行四边形上按 (s,t) 取点：P = O + s*U + t*V */
function onFace(O, U, V, s, t) {
  const a = lerp(O, U, s);
  const b = lerp(O, V, t);
  return [a[0] + b[0] - O[0], a[1] + b[1] - O[1]];
}

/** 平行四边形面内的网格线（n 等分） */
function gridLines(O, U, V, n) {
  const lines = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    lines.push([onFace(O, U, V, t, 0), onFace(O, U, V, t, 1)]);
    lines.push([onFace(O, U, V, 0, t), onFace(O, U, V, 1, t)]);
  }
  return lines;
}

const path = (lines) =>
  lines.map(([a, b]) => `M ${pt(a)} L ${pt(b)}`).join(" ");

// 顶面：O=T, U=R, V=L
const topGrid = gridLines(T, R, L, 3);
// 左侧面：O=L, U=C, V=BL
const leftGrid = gridLines(L, C, BL, 2);
// 右侧面：O=R, U=C, V=BR
const rightGrid = gridLines(R, C, BR, 2);

// 实线棱（隐藏的后底棱 BL-BR 不画）
const solidEdges = [
  [T, L],
  [T, R],
  [L, C],
  [R, C],
  [L, BL],
  [R, BR],
  [C, B],
  [BL, B],
  [BR, B],
];

const vertices = [T, L, R, C, BL, BR, B];

const mainEdges = solidEdges.map(([a, b]) => `M ${pt(a)} L ${pt(b)}`).join(" ");
const topGridPath = path(topGrid);
const sideGridPath = path([...leftGrid, ...rightGrid]);

const vertexDots = vertices
  .map(
    ([x, y]) =>
      `  <circle cx="${n(x)}" cy="${n(y)}" r="22" fill="#FFFFFF" fill-opacity="0.18"/>\n` +
      `  <circle cx="${n(x)}" cy="${n(y)}" r="11" fill="#FFFFFF"/>`,
  )
  .join("\n");

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PluginThreeD">
  <defs>
    <linearGradient id="halo3d-bg" gradientUnits="userSpaceOnUse" x1="40" y1="24" x2="472" y2="488">
      <stop stop-color="#22D3EE"/>
      <stop offset="0.55" stop-color="#3B82F6"/>
      <stop offset="1" stop-color="#4F46E5"/>
    </linearGradient>
    <radialGradient id="halo3d-glow" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(140 72) rotate(48) scale(430)">
      <stop stop-color="#FFFFFF" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- 渐变底 -->
  <rect width="512" height="512" fill="url(#halo3d-bg)"/>
  <rect width="512" height="512" fill="url(#halo3d-glow)"/>

  <!-- 轨道环 -->
  <g stroke="#FFFFFF" stroke-opacity="0.26" stroke-width="5" fill="none">
    <ellipse cx="256" cy="282" rx="200" ry="140" transform="rotate(-15 256 282)"/>
    <ellipse cx="256" cy="282" rx="146" ry="100" transform="rotate(-15 256 282)"/>
  </g>

  <!-- 立方体面内网格 -->
  <g stroke="#FFFFFF" stroke-opacity="0.34" stroke-width="6" stroke-linecap="round" fill="none">
    <path d="${topGridPath}"/>
    <path d="${sideGridPath}"/>
  </g>

  <!-- 立方体棱线 -->
  <path d="${mainEdges}" stroke="#FFFFFF" stroke-width="17" stroke-linecap="round" stroke-linejoin="round" fill="none"/>

  <!-- 顶点节点 -->
  <g>
${vertexDots}
  </g>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg, "utf8");
console.log(`logo.svg written: ${OUT} (${Buffer.byteLength(svg)} bytes)`);
