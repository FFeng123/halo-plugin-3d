import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/**
 * 运行时静态资源的基地址。
 *
 * 解码器（Draco / Basis/KTX2）是独立的 .js / .wasm 文件，
 * 没法打进 bundle，需要在运行时按路径去取。
 *
 * 这里通过「当前正在执行的 script 的 src」反推目录，
 * 这样即使站点部署在子路径下、或者插件被改名，也能正确找到同目录下的解码器。
 */
const RUNTIME_BASE_URL = (() => {
  if (typeof document === "undefined") {
    return "/plugins/PluginThreeD/assets/console/";
  }

  const current = document.currentScript as HTMLScriptElement | null;
  const fromCurrent = current?.src;

  const fromDom = Array.from(document.getElementsByTagName("script"))
    .map((script) => script.src)
    .find((src) => src && src.includes("halo-3d-runtime"));

  const src = fromCurrent || fromDom;
  if (src) {
    return src.slice(0, src.lastIndexOf("/") + 1);
  }

  return "/plugins/PluginThreeD/assets/console/";
})();

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
 * 复用解码器 / 加载器实例。
 *
 * DRACOLoader 内部会创建 worker 池，KTX2Loader 会缓存转码后的纹理，
 * 每次都新建会明显变慢且浪费内存。
 */
let dracoLoader: DRACOLoader | undefined;
let ktx2Loader: KTX2Loader | undefined;
let ktx2Renderer: THREE.WebGLRenderer | undefined;

function getDracoLoader(): DRACOLoader {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(`${RUNTIME_BASE_URL}draco/`);
    // 避免一次性占满 worker
    dracoLoader.setDecoderConfig({ type: "wasm" });
  }
  return dracoLoader;
}

function getKtx2Loader(renderer?: THREE.WebGLRenderer): KTX2Loader | undefined {
  // KTX2Loader 需要知道当前渲染器支持哪些压缩纹理格式
  if (!renderer) return ktx2Loader;
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath(`${RUNTIME_BASE_URL}basis/`);
  }
  if (ktx2Renderer !== renderer) {
    ktx2Loader.detectSupport(renderer);
    ktx2Renderer = renderer;
  }
  return ktx2Loader;
}

/**
 * 创建配置好的 GLTFLoader。
 *
 * glTF 生态里常见的三种压缩都要显式挂上解码器，否则会直接抛错：
 *
 * - `KHR_draco_mesh_compression` → 需要 DRACOLoader
 *   （不提供时报 `No DRACOLoader instance provided.`）；
 * - `EXT_meshopt_compression` → 需要 MeshoptDecoder；
 * - `KHR_texture_basisu` → 需要 KTX2Loader + basis 转码器。
 */
function createGltfLoader(renderer?: THREE.WebGLRenderer): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(getDracoLoader());
  loader.setMeshoptDecoder(MeshoptDecoder);

  const ktx2 = getKtx2Loader(renderer);
  if (ktx2) {
    loader.setKTX2Loader(ktx2);
  }

  return loader;
}

export interface LoadModelOptions {
  /** 用于 KTX2 压缩纹理的能力探测 */
  renderer?: THREE.WebGLRenderer;
}

/**
 * 加载模型。
 *
 * - `.glb` / `.gltf`：使用 GLTFLoader（已挂 Draco / Meshopt / KTX2 解码器）；
 * - `.fbx`：使用 FBXLoader；
 * - `.obj`：使用 OBJLoader，若同时提供 `.mtl` 则通过 MTLLoader 加载材质
 *   （MTL 中引用的贴图会相对于 MTL 文件的地址进行解析，
 *    因此把 `.mtl` 与贴图一起上传到附件即可正常显示）。
 */
export async function loadModel(
  src: string,
  mtlSrc?: string,
  options: LoadModelOptions = {}
): Promise<THREE.Object3D> {
  const extension = getFileExtension(src);

  switch (extension) {
    case "glb":
    case "gltf": {
      const gltf = await createGltfLoader(options.renderer).loadAsync(src);
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
