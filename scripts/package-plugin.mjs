/**
 * 打包脚本：把 src/main/resources 下的全部内容（plugin.yaml + logo.svg + console/）
 * 打成一个可上传的插件包。
 *
 *   node scripts/package-plugin.mjs
 *
 * 产物：dist/PluginThreeD-<version>.jar
 *
 * Halo 使用 pf4j 加载插件，插件包本质是一个 zip，
 * 其中 plugin.yaml 必须位于压缩包根目录。
 * 图标放在 resources 根目录，Halo 会解析成
 * /plugins/<name>/assets/logo.svg?version=<spec.version>。
 */
import { deflateRawSync } from "node:zlib";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const resourcesDir = join(projectRoot, "src", "main", "resources");
const manifestPath = join(resourcesDir, "plugin.yaml");
const consoleDir = join(resourcesDir, "console");
const outputDir = join(projectRoot, "dist");

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return listFiles(full, base);
    }
    return [full];
  });
}

function toPosix(path) {
  return path.split(sep).join("/");
}

/** 构造一个 zip 文件 */
function createZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const raw = entry.data;
    const compressed = deflateRawSync(raw, { level: 9 });
    const checksum = crc32(raw);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    localHeader.writeUInt16LE(8, 8); // method: deflate
    localHeader.writeUInt16LE(0, 10); // time
    localHeader.writeUInt16LE(0x21, 12); // date: 1980-01-01
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    chunks.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x21, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra
    centralHeader.writeUInt16LE(0, 32); // comment
    centralHeader.writeUInt16LE(0, 34); // disk
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42);

    central.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + compressed.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuffer, end]);
}

function readVersion() {
  const manifest = readFileSync(manifestPath, "utf8");
  // 只认 spec 下缩进 2 格的 version，避免误匹配到别的字段
  const match = manifest.match(/^ {2}version:[ \t]*["']?([^"'\s]+)["']?/m);
  return match ? match[1] : "0.0.0";
}

function readPluginName() {
  const manifest = readFileSync(manifestPath, "utf8");
  // 只认 metadata 下缩进 2 格的 name，避免误匹配到 author.name
  const match = manifest.match(/^ {2}name:[ \t]*["']?([^"'\s]+)["']?/m);
  return match ? match[1] : "PluginThreeD";
}

if (!existsSync(manifestPath)) {
  console.error("找不到插件清单：", manifestPath);
  process.exit(1);
}

if (!existsSync(consoleDir)) {
  console.error("找不到前端构建产物，请先执行 npm run build");
  process.exit(1);
}

const entries = [
  {
    name: "plugin.yaml",
    data: readFileSync(manifestPath),
  },
];

// 插件包里要带上 src/main/resources 下的全部内容：
//   plugin.yaml（根目录，Halo 用它识别插件）
//   logo.svg（图标，Halo 解析成 /plugins/<name>/assets/logo.svg）
//   console/**（控制台包 + 公开站运行时包 + draco / basis 解码器）
for (const file of listFiles(resourcesDir)) {
  const rel = toPosix(relative(resourcesDir, file));
  if (rel === "plugin.yaml") continue;
  entries.push({
    name: rel,
    data: readFileSync(file),
  });
}

const pluginName = readPluginName();
const version = readVersion();
const outputPath = join(outputDir, `${pluginName}-${version}.jar`);

mkdirSync(outputDir, { recursive: true });

const zipBuffer = createZip(entries);

/**
 * 防呆：同版本号但内容变了 = 浏览器会继续用旧缓存。
 *
 * Halo 在注入插件前端资源时会带上版本参数
 * （源码 `PluginReconciler.resolveStaticResources()`）：
 *
 *   /plugins/<name>/assets/console/main.js?version=<plugin.yaml 的 spec.version>
 *   /plugins/<name>/assets/console/style.css?version=<同上>
 *
 * 也就是说：**plugin.yaml 的 version 不变，浏览器就会一直用缓存里的旧 main.js**，
 * 哪怕 jar 里的代码已经换了。这会导致"改了却完全没生效"这种极难排查的现象。
 *
 * zip 里写的是固定时间戳，所以同样的输入会产出完全相同的字节，
 * 直接用字节比较来判断"同版本但内容不同"即可。
 */
if (existsSync(outputPath)) {
  const previous = readFileSync(outputPath);
  if (!previous.equals(zipBuffer)) {
    console.warn("");
    console.warn("⚠️  警告：版本号仍然是 " + version + "，但打包内容已经变化！");
    console.warn("    Halo 注入资源的地址是：");
    console.warn(
      `      /plugins/${pluginName}/assets/console/main.js?version=${version}`
    );
    console.warn(
      `      /plugins/${pluginName}/assets/console/style.css?version=${version}`
    );
    console.warn("    版本号不变 => 地址不变 => 浏览器会继续使用缓存的旧代码。");
    console.warn(
      `    请把 src/main/resources/plugin.yaml 里的 spec.version 改成新版本（例如提升 patch 号），再重新打包。`
    );
    console.warn("");
  }
}

writeFileSync(outputPath, zipBuffer);

console.log(`✅ 插件包已生成：${outputPath}`);
console.log(`   版本：${version}`);
console.log("   Halo 将按以下地址加载前端资源（带版本参数，可用于破缓存）：");
console.log(
  `      /plugins/${pluginName}/assets/console/main.js?version=${version}`
);
console.log(
  `      /plugins/${pluginName}/assets/console/style.css?version=${version}`
);
console.log(
  `      /plugins/${pluginName}/assets/logo.svg?version=${version}（插件图标）`
);
entries.forEach((entry) => {
  console.log(`   - ${entry.name} (${(entry.data.length / 1024).toFixed(1)} KB)`);
});
