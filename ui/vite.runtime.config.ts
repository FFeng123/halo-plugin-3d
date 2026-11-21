import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

// 公开站点运行时（文章内 <script> 加载）
//
// 产物：src/main/resources/console/halo-3d-runtime.js
// Halo 会把插件 classpath 下的 console/ 目录映射到 /plugins/{插件名}/assets/console/，
// 因此公开站点可以直接用 <script src="/plugins/PluginThreeD/assets/console/halo-3d-runtime.js"> 引入。
//
// 该 bundle 内联了 three.js 及其加载器，不依赖控制台运行时的任何全局变量。

const projectUiDir = dirname(fileURLToPath(import.meta.url));
const threeLibsDir = join(projectUiDir, "node_modules", "three", "examples", "jsm");
const outDir = resolve(projectUiDir, "../src/main/resources/console");

/**
 * 需要随插件一起发布的解码器文件。
 *
 * 这些是独立的 .js / .wasm，没法内联进 bundle，
 * 必须放到运行时同目录下，由 DRACOLoader / KTX2Loader 按路径去取：
 *
 * - `draco/`：glTF 的 `KHR_draco_mesh_compression`
 *   （缺了会直接报 `No DRACOLoader instance provided.`）；
 * - `basis/`：glTF 的 `KHR_texture_basisu` 压缩纹理。
 */
const DECODER_ASSETS = [
  {
    dir: "draco",
    files: ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"],
  },
  {
    dir: "basis",
    files: ["basis_transcoder.js", "basis_transcoder.wasm"],
  },
];

/**
 * 把解码器文件拷到产物目录。
 *
 * ⚠ 必须在 `build:console` **之后**执行：控制台包是 `emptyOutDir: true`，
 * 会清空整个 console 目录，所以只能由运行时构建（本配置，`emptyOutDir: false`）
 * 在打包结束时把解码器补进去。
 */
function copyDecoderAssets() {
  return {
    name: "halo-3d-copy-decoder-assets",
    closeBundle() {
      for (const asset of DECODER_ASSETS) {
        const targetDir = join(outDir, asset.dir);
        mkdirSync(targetDir, { recursive: true });
        for (const file of asset.files) {
          const source = join(threeLibsDir, "libs", asset.dir, file);
          if (!existsSync(source)) {
            console.warn(`[halo-plugin-3d] 找不到解码器文件：${source}`);
            continue;
          }
          copyFileSync(source, join(targetDir, file));
        }
        console.log(
          `   - ${asset.dir}/ (${asset.files.length} 个解码器文件已复制)`
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [copyDecoderAssets()],
  build: {
    outDir,
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
