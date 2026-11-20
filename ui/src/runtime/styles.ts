const STYLE_ID = "halo-3d-runtime-style";

const CSS = `
.halo-3d-model {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
  margin: 1rem auto;
  box-sizing: border-box;
  isolation: isolate;
  background: transparent;
}

.halo-3d-model canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
  touch-action: none;
  outline: none;
}

.halo-3d-model__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.halo-3d-model__overlay a {
  pointer-events: auto;
  color: inherit;
  text-decoration: underline;
}

.halo-3d-model--light .halo-3d-model__overlay {
  color: #475569;
  background-color: rgba(248, 250, 252, 0.78);
}

.halo-3d-model--dark .halo-3d-model__overlay {
  color: #cbd5e1;
  background-color: rgba(15, 23, 42, 0.78);
}

.halo-3d-spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid currentColor;
  border-top-color: transparent;
  opacity: 0.7;
  animation: halo-3d-spin 0.9s linear infinite;
}

@keyframes halo-3d-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .halo-3d-spinner {
    animation: none;
  }
}
`;

/** 注入运行时样式（只会执行一次） */
export function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
