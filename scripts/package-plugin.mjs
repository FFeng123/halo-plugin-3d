/**
 * 打包脚本：把 plugin.yaml 与 console/ 目录打成一个可上传的插件包。
 *
 *   node scripts/package-plugin.mjs
 *
 * 产物：dist/PluginThreeD-<version>.jar
 *
 * Halo 使用 pf4j 加载插件，插件包本质是一个 zip，
 * 其中 plugin.yaml 必须位于压缩包根目录。
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
  const match = manifest.match(/^\s*version:\s*["']?([^"'\s]+)["']?/m);
  return match ? match[1] : "0.0.0";
}

function readPluginName() {
  const manifest = readFileSync(manifestPath, "utf8");
  const match = manifest.match(/^\s*name:\s*["']?([^"'\s]+)["']?/m);
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

for (const file of listFiles(consoleDir)) {
  entries.push({
    name: toPosix(relative(resourcesDir, file)),
    data: readFileSync(file),
  });
}

const pluginName = readPluginName();
const version = readVersion();
const outputPath = join(outputDir, `${pluginName}-${version}.jar`);

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, createZip(entries));

console.log(`✅ 插件包已生成：${outputPath}`);
entries.forEach((entry) => {
  console.log(`   - ${entry.name} (${(entry.data.length / 1024).toFixed(1)} KB)`);
});
