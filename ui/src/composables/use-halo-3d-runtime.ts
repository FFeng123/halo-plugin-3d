import { RUNTIME_SCRIPT_URL } from "@/constants";
import type { Halo3DRuntime } from "@/types";

let runtimePromise: Promise<Halo3DRuntime> | undefined;

/**
 * 加载公开站点使用的 3D 运行时。
 *
 * 运行时代码（包含 three.js）体积较大，因此不在控制台插件包里重复打包一份，
 * 而是直接从 Halo 的插件静态资源地址加载：
 * `/plugins/{插件名}/assets/console/halo-3d-runtime.js`
 */
export function loadHalo3DRuntime(): Promise<Halo3DRuntime> {
  if (window.Halo3D) {
    return Promise.resolve(window.Halo3D);
  }

  if (!runtimePromise) {
    runtimePromise = new Promise<Halo3DRuntime>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = RUNTIME_SCRIPT_URL;
      script.async = true;
      script.dataset.halo3dRuntime = "true";

      script.addEventListener(
        "load",
        () => {
          if (window.Halo3D) {
            resolve(window.Halo3D);
          } else {
            runtimePromise = undefined;
            reject(new Error("3D 运行时加载完成，但未暴露 Halo3D 接口"));
          }
        },
        { once: true }
      );

      script.addEventListener(
        "error",
        () => {
          runtimePromise = undefined;
          reject(new Error(`3D 运行时加载失败：${RUNTIME_SCRIPT_URL}`));
        },
        { once: true }
      );

      document.head.appendChild(script);
    });
  }

  return runtimePromise;
}
