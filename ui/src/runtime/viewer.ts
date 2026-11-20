import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { disposeObject, loadModel } from "./loader";
import { detectColorScheme, type ColorScheme } from "./theme";

export interface ViewerOptions {
  src: string;
  mtlSrc?: string;
  name?: string;
  width?: string;
  height?: string;
  theme?: "auto" | "light" | "dark";
  autoRotate?: boolean;
  background?: "none" | "solid" | "gradient";
  grid?: boolean;
  controls?: boolean;
}

interface ThemePreset {
  gradient: string;
  solid: string;
  gridPrimary: string;
  gridSecondary: string;
  hemisphere: number;
  key: number;
  fill: number;
  ambient: number;
  exposure: number;
}

const THEME_PRESETS: Record<ColorScheme, ThemePreset> = {
  light: {
    gradient: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
    solid: "#f8fafc",
    gridPrimary: "#cbd5e1",
    gridSecondary: "#e6ebf2",
    hemisphere: 1.1,
    key: 1.6,
    fill: 0.45,
    ambient: 0.25,
    exposure: 1,
  },
  dark: {
    gradient: "linear-gradient(180deg, #1e293b 0%, #0b1220 100%)",
    solid: "#0b1220",
    gridPrimary: "#475569",
    gridSecondary: "#1e293b",
    hemisphere: 0.6,
    key: 1.25,
    fill: 0.3,
    ambient: 0.18,
    exposure: 1.15,
  },
};

/** 归一化后模型的最大边长 */
const NORMALIZED_SIZE = 2;

/** 判断包围盒是否包含 NaN / Infinity */
function isFiniteBox(box: THREE.Box3): boolean {
  return (
    Number.isFinite(box.min.x) &&
    Number.isFinite(box.min.y) &&
    Number.isFinite(box.min.z) &&
    Number.isFinite(box.max.x) &&
    Number.isFinite(box.max.y) &&
    Number.isFinite(box.max.z)
  );
}

/**
 * 3D 模型查看器。
 *
 * 负责创建 WebGL 场景、加载模型、自适应相机，并根据站点主题调整灯光与背景。
 */
export class ThreeModelViewer {
  private readonly container: HTMLElement;
  private readonly options: Required<ViewerOptions>;
  private scheme: ColorScheme;

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private grid?: THREE.GridHelper;
  private pivot?: THREE.Group;
  private lights?: {
    hemisphere: THREE.HemisphereLight;
    key: THREE.DirectionalLight;
    fill: THREE.DirectionalLight;
    ambient: THREE.AmbientLight;
  };

  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private overlay?: HTMLElement;
  private modelBottomY = -NORMALIZED_SIZE / 2;
  private inViewport = true;
  private disposed = false;

  constructor(container: HTMLElement, options: ViewerOptions) {
    this.container = container;
    this.options = {
      src: options.src || "",
      mtlSrc: options.mtlSrc || "",
      name: options.name || "",
      width: options.width || "100%",
      height: options.height || "420px",
      theme: options.theme || "auto",
      autoRotate: options.autoRotate !== false,
      background: options.background || "solid",
      grid: options.grid !== false,
      controls: options.controls !== false,
    };
    this.scheme =
      this.options.theme === "auto"
        ? detectColorScheme()
        : (this.options.theme as ColorScheme);

    this.setup();
  }

  private setup(): void {
    const container = this.container;
    container.classList.add("halo-3d-model");
    container.style.width = this.options.width;
    container.style.height = this.options.height;

    const scene = new THREE.Scene();
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);
    camera.position.set(0, 1, 4);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.autoRotate = this.options.autoRotate;
    controls.autoRotateSpeed = 1.6;
    controls.maxPolarAngle = Math.PI * 0.95;
    this.controls = controls;

    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x8b93a7, 1);
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(3, 5, 4);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-4, 2, -3);
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(hemisphere, key, fill, ambient);
    this.lights = { hemisphere, key, fill, ambient };

    this.applyTheme();

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }

    if (typeof IntersectionObserver !== "undefined") {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          this.inViewport = entries.some((entry) => entry.isIntersecting);
        },
        { rootMargin: "120px" }
      );
      this.intersectionObserver.observe(container);
    }

    renderer.setAnimationLoop(() => this.render());
    this.resize();
  }

  /** 加载模型 */
  async load(): Promise<void> {
    if (!this.options.src) {
      this.showOverlay("未指定模型文件", "error");
      return;
    }

    this.showOverlay(
      `正在加载模型${this.options.name ? ` ${this.options.name}` : ""}…`,
      "loading"
    );

    try {
      const object = await loadModel(this.options.src, this.options.mtlSrc);
      if (this.disposed) {
        disposeObject(object);
        return;
      }
      this.setModel(object);
      if (this.pivot) {
        this.hideOverlay();
      }
    } catch (error) {
      console.error("[halo-plugin-3d] 模型加载失败", error);
      const message =
        error instanceof Error ? error.message : "未知错误";
      this.showOverlay(`模型加载失败：${message}`, "error");
    }
  }

  private setModel(object: THREE.Object3D): void {
    if (this.pivot) {
      this.scene?.remove(this.pivot);
      disposeObject(this.pivot);
    }

    const pivot = new THREE.Group();
    object.updateMatrixWorld(true);
    pivot.attach(object);
    this.scene?.add(pivot);
    this.pivot = pivot;

    const box = new THREE.Box3().setFromObject(pivot);
    if (box.isEmpty() || !isFiniteBox(box)) {
      // 模型文件本身有问题（例如 OBJ 索引越界导致顶点出现 NaN），
      // 此时 three.js 不会抛错，但画面会是空的，这里给出明确提示。
      this.scene?.remove(pivot);
      disposeObject(pivot);
      this.pivot = undefined;
      this.showOverlay("模型文件解析失败，请检查模型文件是否完整", "error");
      return;
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const scale = NORMALIZED_SIZE / maxDimension;

    pivot.scale.setScalar(scale);
    pivot.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    pivot.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(pivot);
    this.modelBottomY = scaledBox.min.y;
    this.updateGrid();
    this.frameCamera(scaledBox);
  }

  private frameCamera(box: THREE.Box3): void {
    if (!this.camera || !this.controls) return;

    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = sphere.radius || 1;
    const fov = (this.camera.fov * Math.PI) / 180;
    const distance = (radius / Math.sin(fov / 2)) * 1.2;
    const direction = new THREE.Vector3(0.8, 0.55, 1).normalize();

    this.camera.position
      .copy(center)
      .addScaledVector(direction, distance);
    this.camera.near = Math.max(distance / 1000, 0.001);
    this.camera.far = distance * 100;
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(center);
    this.controls.minDistance = distance * 0.15;
    this.controls.maxDistance = distance * 4;
    this.controls.update();
  }

  /** 更新渲染参数（不会重复加载模型，除非模型地址发生变化） */
  update(options: Partial<ViewerOptions>): void {
    const previousSrc = this.options.src;
    Object.assign(this.options, options);

    this.container.style.width = this.options.width;
    this.container.style.height = this.options.height;

    if (this.controls) {
      this.controls.autoRotate = this.options.autoRotate;
      this.controls.enabled = this.options.controls;
    }

    this.applyScheme(this.effectiveScheme(), true);
    this.updateGrid();
    this.resize();

    if (this.options.src !== previousSrc) {
      void this.load();
    }
  }

  private effectiveScheme(): ColorScheme {
    return this.options.theme === "auto"
      ? detectColorScheme()
      : (this.options.theme as ColorScheme);
  }

  /**
   * 应用配色方案。
   *
   * @param scheme 配色方案
   * @param force 是否忽略「跟随站点」的设置强制应用
   */
  applyScheme(scheme: ColorScheme, force = false): void {
    if (!force && this.options.theme !== "auto") return;
    this.scheme = scheme;
    this.applyTheme();
  }

  private applyTheme(): void {
    const preset = THEME_PRESETS[this.scheme];

    this.container.classList.toggle("halo-3d-model--light", this.scheme === "light");
    this.container.classList.toggle("halo-3d-model--dark", this.scheme === "dark");

    if (this.options.background === "gradient") {
      this.container.style.background = preset.gradient;
    } else if (this.options.background === "solid") {
      this.container.style.background = preset.solid;
    } else {
      this.container.style.background = "transparent";
    }

    if (this.renderer) {
      this.renderer.toneMappingExposure = preset.exposure;
    }
    if (this.lights) {
      this.lights.hemisphere.intensity = preset.hemisphere;
      this.lights.key.intensity = preset.key;
      this.lights.fill.intensity = preset.fill;
      this.lights.ambient.intensity = preset.ambient;
    }
  }

  private updateGrid(): void {
    if (!this.scene) return;

    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
      this.grid = undefined;
    }

    if (!this.options.grid) return;

    const preset = THEME_PRESETS[this.scheme];
    const grid = new THREE.GridHelper(
      NORMALIZED_SIZE * 5,
      40,
      new THREE.Color(preset.gridPrimary),
      new THREE.Color(preset.gridSecondary)
    );
    const material = grid.material as THREE.Material;
    material.transparent = true;
    material.opacity = 0.7;
    grid.position.y = this.modelBottomY;
    this.scene.add(grid);
    this.grid = grid;
  }

  private resize(): void {
    if (!this.renderer || !this.camera) return;
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private render(): void {
    if (this.disposed || !this.inViewport) return;
    this.controls?.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private clearOverlay(): void {
    this.overlay?.remove();
    this.overlay = undefined;
  }

  private showOverlay(
    message: string,
    type: "loading" | "error"
  ): void {
    this.clearOverlay();
    const overlay = document.createElement("div");
    overlay.className = "halo-3d-model__overlay";

    if (type === "loading") {
      const spinner = document.createElement("div");
      spinner.className = "halo-3d-spinner";
      overlay.appendChild(spinner);
    }

    const text = document.createElement("div");
    text.textContent = message;
    overlay.appendChild(text);

    if (type === "error" && this.options.src) {
      const link = document.createElement("a");
      link.href = this.options.src;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "在新窗口打开模型文件";
      overlay.appendChild(link);
    }

    this.container.appendChild(overlay);
    this.overlay = overlay;
  }

  private hideOverlay(): void {
    this.clearOverlay();
  }

  /** 销毁查看器，释放所有资源 */
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.renderer?.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.controls?.dispose();
    this.clearOverlay();

    if (this.pivot) {
      this.scene?.remove(this.pivot);
      disposeObject(this.pivot);
      this.pivot = undefined;
    }
    if (this.grid) {
      this.scene?.remove(this.grid);
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
      this.grid = undefined;
    }

    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = undefined;
  }
}
