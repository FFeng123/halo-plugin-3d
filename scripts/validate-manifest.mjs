/**
 * 校验 plugin.yaml 是否符合 Halo 2.21.x 的 Plugin 资源契约。
 *
 *   node scripts/validate-manifest.mjs
 *
 * 校验项来自 Halo 源码：
 *   api/src/main/java/run/halo/app/core/extension/Plugin.java  → PluginSpec 字段与 SemVer 正则
 *   application/.../core/reconciler/PluginReconciler.java        → logo / 静态资源解析规则
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 依赖装在 ui/ 里（前端工程），这里显式从 ui/package.json 解析
const require = createRequire(
  resolve(dirname(fileURLToPath(import.meta.url)), "../ui/package.json")
);
const yaml = require("js-yaml");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(scriptDir, "../src/main/resources/plugin.yaml");

/** Halo PluginSpec 里定义的字段 */
const SPEC_FIELDS = [
  "displayName",
  "version",
  "author",
  "logo",
  "pluginDependencies",
  "homepage",
  "repo",
  "issues",
  "description",
  "license",
  "requires",
  "enabled",
  "settingName",
  "configMapName",
];

/** Halo PluginSpec.version 上的 SemVer 正则（摘自 Plugin.java） */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:[0-9a-zA-Z-]*[0-9a-zA-Z-]+)*))?$/;

const errors = [];
const warnings = [];
const ok = [];

const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);
const pass = (msg) => ok.push(msg);

const manifest = yaml.load(readFileSync(manifestPath, "utf8"));

// ---- 顶层 ----
if (manifest.apiVersion !== "plugin.halo.run/v1alpha1") {
  fail(`apiVersion 应为 plugin.halo.run/v1alpha1，实际是 ${manifest.apiVersion}`);
} else {
  pass("apiVersion 正确");
}

if (manifest.kind !== "Plugin") {
  fail(`kind 应为 Plugin，实际是 ${manifest.kind}`);
} else {
  pass("kind 正确");
}

// ---- metadata ----
const name = manifest.metadata?.name;
if (!name) {
  fail("缺少 metadata.name");
} else if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
  fail(
    `metadata.name「${name}」不是合法的 JavaScript 标识符。` +
      "Halo 控制台用 window.<name> 取插件模块（PluginReconciler 注释亦明确要求），" +
      "带短横线会导致插件加载不到。"
  );
} else {
  pass(`metadata.name「${name}」是合法 JS 标识符`);
}

// ---- spec ----
const spec = manifest.spec ?? {};
for (const key of Object.keys(spec)) {
  if (!SPEC_FIELDS.includes(key)) {
    warn(`spec.${key} 不在 Halo PluginSpec 的字段列表里，可能不会被识别`);
  }
}

if (!SEMVER_RE.test(String(spec.version))) {
  fail(`spec.version「${spec.version}」不符合 SemVer`);
} else {
  pass(`spec.version「${spec.version}」符合 SemVer`);
}

if (!spec.requires) {
  fail("缺少 spec.requires");
} else {
  pass(`spec.requires「${spec.requires}」`);
}

if (!spec.displayName) fail("缺少 spec.displayName");
if (!spec.description) fail("缺少 spec.description");

if (!spec.author?.name) {
  fail("缺少 spec.author.name");
}
if (!spec.author?.website) {
  warn("spec.author.website 未填写");
}

if (!spec.logo) {
  fail("缺少 spec.logo —— 插件在控制台列表 / 详情页将没有图标");
} else if (/^https?:\/\//.test(spec.logo) || spec.logo.startsWith("data:image")) {
  pass("spec.logo 是 URL 或 base64");
} else {
  pass(`spec.logo「${spec.logo}」是相对于 src/main/resources 的路径`);
  if (!spec.logo.endsWith(".svg") && !spec.logo.endsWith(".png")) {
    warn("spec.logo 既不是 .svg 也不是 .png");
  }
}

if (!Array.isArray(spec.license) || spec.license.length === 0) {
  fail("缺少 spec.license");
} else {
  pass(`spec.license 共 ${spec.license.length} 项`);
}

if (spec.settingName && !spec.configMapName) {
  warn("设置了 spec.settingName 却没有 spec.configMapName");
}
if (spec.configMapName && !spec.settingName) {
  warn("设置了 spec.configMapName 却没有 spec.settingName");
}

ok.forEach((m) => console.log(`  ✅ ${m}`));
warnings.forEach((m) => console.log(`  ⚠️  ${m}`));
errors.forEach((m) => console.error(`  ❌ ${m}`));

console.log("");
if (errors.length) {
  console.error(`❌ plugin.yaml 校验未通过：${errors.length} 个错误，${warnings.length} 个提醒`);
  process.exit(1);
}
console.log(`✅ plugin.yaml 校验通过（${warnings.length} 个提醒）`);
