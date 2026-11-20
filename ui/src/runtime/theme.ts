/** 站点当前的配色方案 */
export type ColorScheme = "light" | "dark";

/** 可能表示暗色主题的属性值 */
const DARK_VALUES = ["dark", "night", "black", "dim"];

/** 常见的用于声明主题的属性名 */
const THEME_ATTRIBUTES = [
  "data-theme",
  "data-appearance",
  "data-color-mode",
  "data-mode",
  "data-bs-theme",
  "data-color-scheme",
];

function readThemeAttribute(el: Element | null): string | undefined {
  if (!el) return undefined;
  for (const name of THEME_ATTRIBUTES) {
    const value = el.getAttribute(name);
    if (value) {
      return value.trim().toLowerCase();
    }
  }
  return undefined;
}

/**
 * 识别站点当前的亮色 / 暗色主题。
 *
 * 依次尝试：
 * 1. `html` / `body` 上的主题属性（`data-theme="dark"` 等，Tailwind themer、Hugo、Vuepress 等均使用该约定）；
 * 2. `html` / `body` 上的 `dark` / `light` class（Tailwind `darkMode: "class"` 约定）；
 * 3. 系统的 `prefers-color-scheme`。
 */
export function detectColorScheme(): ColorScheme {
  const root = document.documentElement;
  const body = document.body;

  const attributeValue = readThemeAttribute(root) ?? readThemeAttribute(body);
  if (attributeValue) {
    return DARK_VALUES.includes(attributeValue) ? "dark" : "light";
  }

  if (root.classList.contains("dark") || body?.classList.contains("dark")) {
    return "dark";
  }
  if (root.classList.contains("light") || body?.classList.contains("light")) {
    return "light";
  }

  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return "light";
}

/**
 * 监听主题变化（属性变化、系统主题变化），返回取消监听的函数。
 */
export function watchColorScheme(
  callback: (scheme: ColorScheme) => void
): () => void {
  const handler = () => callback(detectColorScheme());

  const mediaQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : undefined;
  mediaQuery?.addEventListener?.("change", handler);

  const observer = new MutationObserver(handler);
  const observerOptions: MutationObserverInit = {
    attributes: true,
    attributeFilter: ["class", "style", ...THEME_ATTRIBUTES],
  };
  observer.observe(document.documentElement, observerOptions);
  if (document.body) {
    observer.observe(document.body, observerOptions);
  }

  return () => {
    mediaQuery?.removeEventListener?.("change", handler);
    observer.disconnect();
  };
}
