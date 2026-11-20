import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

/** 取出一个 URL 的小写扩展名 */
export function getFileExtension(url: string): string {
  if (!url) return "";
  const clean = url.split(/[?#]/)[0];
  const base = clean.substring(clean.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot === -1) return "";
  return base.slice(dot + 1).toLowerCase();
}

/**
 * 加载模型。
 *
 * - `.glb` / `.gltf`：使用 GLTFLoader；
 * - `.fbx`：使用 FBXLoader；
 * - `.obj`：使用 OBJLoader，若同时提供 `.mtl` 则通过 MTLLoader 加载材质
 *   （MTL 中引用的贴图会相对于 MTL 文件的地址进行解析，
 *    因此把 `.mtl` 与贴图一起上传到附件即可正常显示）。
 */
export async function loadModel(
  src: string,
  mtlSrc?: string
): Promise<THREE.Object3D> {
  const extension = getFileExtension(src);

  switch (extension) {
    case "glb":
    case "gltf": {
      const gltf = await new GLTFLoader().loadAsync(src);
      return gltf.scene;
    }
    case "fbx": {
      return await new FBXLoader().loadAsync(src);
    }
    case "obj": {
      if (mtlSrc) {
        const materials = await new MTLLoader().loadAsync(mtlSrc);
        materials.preload();
        const object = await new OBJLoader()
          .setMaterials(materials)
          .loadAsync(src);
        return object;
      }
      return await new OBJLoader().loadAsync(src);
    }
    default:
      throw new Error(`不支持的模型格式：.${extension || "未知"}`);
  }
}

/** 释放模型占用的 GPU 资源 */
export function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material as
      | THREE.Material
      | THREE.Material[]
      | undefined;
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((item) => {
      Object.values(item).forEach((value) => {
        if (value && (value as THREE.Texture).isTexture) {
          (value as THREE.Texture).dispose();
        }
      });
      item.dispose();
    });
  });
}
