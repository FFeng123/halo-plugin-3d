import { defineConfig } from "vite";

// 公开站点运行时（文章内 <script> 加载）
//
// 产物：src/main/resources/console/halo-3d-runtime.js
// Halo 会把插件 classpath 下的 console/ 目录映射到 /plugins/{插件名}/assets/console/，
// 因此公开站点可以直接用 <script src="/plugins/PluginThreeD/assets/console/halo-3d-runtime.js"> 引入。
//
// 该 bundle 内联了 three.js 及其加载器，不依赖控制台运行时的任何全局变量。
export default defineConfig({
  build: {
    outDir: "../src/main/resources/console",
    emptyOutDir: false,
    lib: {
      entry: "src/runtime/index.ts",
      name: "Halo3D",
      formats: ["iife"],
      fileName: () => "halo-3d-runtime.js",
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
