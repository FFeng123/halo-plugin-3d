import { fileURLToPath, URL } from "url";

import { viteConfig } from "@halo-dev/ui-plugin-bundler-kit";

// 控制台插件包（main.js / style.css）
// 详见 https://github.com/halo-dev/halo/tree/main/ui/packages/ui-plugin-bundler-kit
export default viteConfig({
  manifestPath: "../src/main/resources/plugin.yaml",
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      outDir: "../src/main/resources/console",
      emptyOutDir: true,
    },
  },
});
