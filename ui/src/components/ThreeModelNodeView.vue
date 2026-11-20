<script lang="ts" setup>
import { NodeViewWrapper } from "@halo-dev/richtext-editor";
import type { NodeViewProps } from "@halo-dev/richtext-editor";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { SettingsIcon } from "@/components/icons";
import ThreeModelSettingsPanel from "@/components/ThreeModelSettingsPanel.vue";
import { loadHalo3DRuntime } from "@/composables/use-halo-3d-runtime";
import type { ThreeModelAttributes } from "@/types";
import { replaceThreeModel } from "@/utils/three-model-actions";
import { selectThreeModel } from "@/utils/three-model-node";

const props = defineProps<NodeViewProps>();

const container = ref<HTMLElement>();
const errorMessage = ref("");
const loading = ref(true);
/** 运行时是否已经成功挂载过一次 */
const mounted = ref(false);
/** 设置面板是否展开 */
const showSettings = ref(false);

const attributes = computed(() => props.node.attrs as ThreeModelAttributes);

/** 只有真正变化的属性才会触发重新挂载 */
const signature = computed(() => JSON.stringify(attributes.value));

function applyDataset(element: HTMLElement) {
  const attrs = attributes.value;
  element.setAttribute("data-halo-3d-model", "true");
  element.setAttribute("data-src", attrs.src);
  element.setAttribute("data-mtl-src", attrs.mtlSrc);
  element.setAttribute("data-name", attrs.name);
  element.setAttribute("data-width", attrs.width);
  element.setAttribute("data-height", attrs.height);
  element.setAttribute("data-theme", attrs.theme);
  element.setAttribute("data-autorotate", String(attrs.autoRotate));
  element.setAttribute("data-background", attrs.background);
  element.setAttribute("data-grid", String(attrs.grid));
  element.setAttribute("data-controls", String(attrs.controls));
}

async function mountViewer() {
  const element = container.value;
  if (!element) return;

  applyDataset(element);

  // 首次挂载才展示加载态，后续属性变化只是热更新，不应该闪一下「加载中」
  if (!mounted.value) {
    loading.value = true;
    errorMessage.value = "";
  }

  try {
    const runtime = await loadHalo3DRuntime();
    runtime.mount(element, {
      // 控制台本身没有暗色模式，因此「跟随站点」在编辑器里按亮色预览
      theme: attributes.value.theme === "auto" ? "light" : attributes.value.theme,
    });
    mounted.value = true;
    loading.value = false;
    errorMessage.value = "";
  } catch (error) {
    loading.value = false;
    errorMessage.value =
      error instanceof Error ? error.message : "3D 运行时加载失败";
  }
}

/**
 * 展开 / 收起设置面板。
 *
 * ⚠ 设置面板**不使用弹窗**，而是直接在节点视图里展开。
 * 之前用弹窗的方案在 Halo 控制台里会出现「DOM 被挤到页面底部、高度为 0」的问题，
 * 面板由 Halo 自己的 Vue 应用渲染就不会有这类问题。
 */
function handleToggleSettings() {
  if (!showSettings.value) {
    // 先把节点选中，面板才能读到正确的属性
    const pos = props.getPos();
    if (typeof pos === "number") {
      selectThreeModel(props.editor, pos);
    }
  }
  showSettings.value = !showSettings.value;
}

/** 面板里的属性改动直接写回节点 */
function handlePatch(patch: Partial<ThreeModelAttributes>) {
  props.updateAttributes({ ...attributes.value, ...patch });
}

onMounted(() => {
  void mountViewer();
});

watch(signature, () => {
  void mountViewer();
});

onBeforeUnmount(() => {
  const element = container.value;
  if (element) {
    window.Halo3D?.unmount(element);
  }
});
</script>

<template>
  <NodeViewWrapper class="halo-3d-node-view">
    <div class="halo-3d-node-view__toolbar">
      <button
        class="halo-3d-node-view__settings"
        type="button"
        title="3D 模型设置"
        @click="handleToggleSettings"
      >
        <SettingsIcon />
      </button>
    </div>
    <div
      ref="container"
      class="halo-3d-model halo-3d-node-view__container"
      :style="{ height: attributes.height }"
    />
    <p v-if="loading" class="halo-3d-node-view__status">正在加载 3D 运行时…</p>
    <p
      v-else-if="errorMessage"
      class="halo-3d-node-view__status halo-3d-node-view__status--error"
    >
      {{ errorMessage }}
    </p>

    <div v-if="showSettings" class="halo-3d-node-view__settings-panel">
      <ThreeModelSettingsPanel
        :editor="props.editor"
        :model="attributes"
        :apply="handlePatch"
        :on-replace="() => void replaceThreeModel(props.editor)"
        :on-close="() => (showSettings = false)"
      />
    </div>
  </NodeViewWrapper>
</template>

<style scoped>
.halo-3d-node-view {
  position: relative;
  display: block;
  margin: 1rem 0;
}

.halo-3d-node-view__toolbar {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.halo-3d-node-view:hover .halo-3d-node-view__toolbar,
.halo-3d-node-view:focus-within .halo-3d-node-view__toolbar {
  opacity: 1;
}

.halo-3d-node-view__settings {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #4b5563;
  cursor: pointer;
  background-color: rgb(255 255 255 / 88%);
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 12%);
}

.halo-3d-node-view__settings:hover {
  color: #047857;
  border-color: #4ccba0;
}

.halo-3d-node-view__settings svg {
  width: 16px;
  height: 16px;
}

.halo-3d-node-view__container {
  width: 100%;
  border-radius: 8px;
  outline: 1px dashed rgb(156 163 175 / 40%);
}

.halo-3d-node-view__status {
  margin: 6px 0 0;
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
}

.halo-3d-node-view__status--error {
  color: #dc2626;
}

.halo-3d-node-view__settings-panel {
  margin-top: 10px;
  padding: 12px;
  background-color: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 6%);
}
</style>
