/**
 * 用 Node 直接跑 three 的 OBJLoader，检查解析结果是否包含 NaN。
 *
 *   node test/check-obj.mjs
 */
import { readFileSync } from "node:fs";
import { OBJLoader } from "../ui/node_modules/three/examples/jsm/loaders/OBJLoader.js";
import { Box3 } from "../ui/node_modules/three/build/three.module.js";

const file = process.argv[2] || "test/fixtures/cube.obj";
const text = readFileSync(file, "utf8");

const object = new OBJLoader().parse(text);

let meshes = 0;
object.traverse((child) => {
  if (!child.isMesh) return;
  meshes += 1;
  const position = child.geometry.getAttribute("position");
  const uv = child.geometry.getAttribute("uv");
  const normal = child.geometry.getAttribute("normal");
  const hasNaN = (attr) =>
    attr ? Array.from(attr.array).some((v) => Number.isNaN(v)) : false;
  console.log(
    `mesh#${meshes} vertices=${position?.count ?? 0}` +
      ` positionNaN=${hasNaN(position)}` +
      ` uvNaN=${hasNaN(uv)}` +
      ` normalNaN=${hasNaN(normal)}` +
      ` material=${child.material?.name || child.material?.type}` +
      ` hasMap=${Boolean(child.material?.map)}`
  );
});

const box = new Box3().setFromObject(object);
console.log("box:", JSON.stringify(box.min), JSON.stringify(box.max));
