import { fileURLToPath, URL } from "url";

import Vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

/**
 * 本地开发用的测试包。
 *
 * 与控制台插件包使用同一套 externals / globals 约定，
 * 因此可以加载 Halo 真实的 `VModal` 来验证弹窗行为。
 */
const GLOBALS: Record<string, string> = {
  vue: "Vue",
  "vue-router": "VueRouter",
  "@vueuse/core": "VueUse",
  "@vueuse/components": "VueUse",
  "@vueuse/router": "VueUse",
  "@halo-dev/console-shared": "HaloConsoleShared",
  "@halo-dev/components": "HaloComponents",
  "@halo-dev/api-client": "HaloApiClient",
  "@halo-dev/richtext-editor": "RichTextEditor",
  axios: "axios",
};

export default defineConfig({
  plugins: [Vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "../test/harness",
    emptyOutDir: true,
    lib: {
      entry: "src/dev/editor-harness.ts",
      name: "Halo3DHarnessBundle",
      formats: ["iife"],
      fileName: () => "harness.js",
    },
    rollupOptions: {
      external: Object.keys(GLOBALS),
      output: {
        globals: GLOBALS,
        extend: true,
      },
    },
  },
});
