/**
 * 本地静态服务器，用于验证公开站点运行时与编辑器集成。
 *
 *   node test/server.mjs [port]
 *
 * 路由：
 *   /                     -> test/demo.html
 *   /editor.html          -> test/editor.html（编辑器集成测试）
 *   /fixtures/*           -> test/fixtures/*
 *   /console/*            -> src/main/resources/console/*
 *   /plugins/...          -> src/main/resources/console/*（模拟 Halo 的插件静态资源）
 *   /harness/*            -> test/harness/*
 *   /vendor/*             -> ui/node_modules/*（仅限白名单里的包）
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const projectRoot = resolve(scriptDir, "..");
const uiRoot = resolve(projectRoot, "ui");
const port = Number(process.argv[2] || 4321);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".obj": "text/plain; charset=utf-8",
  ".mtl": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".bin": "application/octet-stream",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

/** 允许通过 /vendor/* 访问的路径白名单 */
const VENDOR_ALLOW = [
  "vue/dist/vue.global.js",
  "@halo-dev/components/dist/halo-components.iife.js",
  "@halo-dev/richtext-editor/dist/rich-text-editor.iife.js",
];

/**
 * 插件静态资源在真实 Halo 里的路径（resolveFile 里已去掉开头的斜杠）
 * Halo 的路由是 /plugins/{name}/assets/{*resource}，指向插件 jar 根目录（classpath 根），
 * 所以 logo.svg 走 /plugins/PluginThreeD/assets/logo.svg，
 * 而控制台包走 /plugins/PluginThreeD/assets/console/main.js。
 */
const PLUGIN_ASSET_PREFIX = "plugins/PluginThreeD/assets/";

function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0]))
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "")
    .split(/[\\/]/)
    .join("/");

  if (clean === "" || clean === "demo.html") {
    return join(scriptDir, "demo.html");
  }
  if (clean === "editor.html") {
    return join(scriptDir, "editor.html");
  }
  if (clean === "formats.html") {
    return join(scriptDir, "formats.html");
  }
  if (clean.startsWith("fixtures/")) {
    return join(scriptDir, clean);
  }
  if (clean.startsWith("console/")) {
    return join(projectRoot, "src", "main", "resources", clean);
  }
  if (clean.startsWith(PLUGIN_ASSET_PREFIX)) {
    return join(
      projectRoot,
      "src",
      "main",
      "resources",
      clean.slice(PLUGIN_ASSET_PREFIX.length)
    );
  }
  if (clean.startsWith("harness/")) {
    return join(scriptDir, clean);
  }
  if (clean.startsWith("vendor/")) {
    const target = clean.slice("vendor/".length);
    if (!VENDOR_ALLOW.includes(target)) return join(scriptDir, "__denied__");
    return join(uiRoot, "node_modules", target);
  }
  return join(scriptDir, clean);
}

createServer((req, res) => {
  const filePath = resolveFile(req.url || "/");

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found: " + req.url);
    return;
  }

  res.writeHead(200, {
    "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`测试服务器已启动： http://127.0.0.1:${port}/`);
});
