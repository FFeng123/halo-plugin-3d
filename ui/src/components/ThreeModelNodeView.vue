<script lang="ts" setup>
import { NodeViewWrapper } from "@halo-dev/richtext-editor";
import type { NodeViewProps } from "@halo-dev/richtext-editor";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { SettingsIcon } from "@/components/icons";
import AttachmentPickPanel from "@/components/AttachmentPickPanel.vue";
import ThreeModelSettingsPanel from "@/components/ThreeModelSettingsPanel.vue";
import { loadHalo3DRuntime } from "@/composables/use-halo-3d-runtime";
import { MATERIAL_EXTENSIONS, MODEL_EXTENSIONS } from "@/constants";
import type { ThreeModelAttributes } from "@/types";
import { applyMaterial, applyModel } from "@/utils/three-model-actions";
import { selectThreeModel } from "@/utils/three-model-node";

const props = defineProps<NodeViewProps>();

const container = ref<HTMLElement>();
const errorMessage = ref("");
const loading = ref(true);
/** 运行时是否已经成功挂载过一次 */
const mountedViewer = ref(false);
/** 设置面板是否展开 */
const showSettings = ref(false);
/** 是否正在挑选模型（没有模型时强制为真） */
const pickingModel = ref(false);
/** 是否正在挑选材质 */
const pickingMaterial = ref(false);

const attributes = computed(() => props.node.attrs as ThreeModelAttributes);
const hasModel = computed(() => !!attributes.value.src);
/** 只有真正变化的属性才会触发重新挂载 */
const signature = computed(() => JSON.stringify(attributes.value));

/** 没有模型时，直接进入选择状态 */
const showModelPicker = computed(() => !hasModel.value || pickingModel.value);

/** 只有 OBJ 才可能需要 MTL 材质 */
const canPickMaterial = computed(
  () => hasModel.value && (attributes.value.name || "").toLowerCase().endsWith(".obj")
);

function update(patch: Partial<ThreeModelAttributes>) {
  props.updateAttributes(patch);
}

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

  // 还没选模型文件，不需要挂载运行时
  if (!attributes.value.src) {
    loading.value = false;
    return;
  }

  applyDataset(element);

  // 首次挂载才展示加载态，后续属性变化只是热更新，不应该闪一下「加载中」
  if (!mountedViewer.value) {
    loading.value = true;
    errorMessage.value = "";
  }

  try {
    const runtime = await loadHalo3DRuntime();
    runtime.mount(element, {
      // 控制台本身没有暗色模式，因此「跟随站点」在编辑器里按亮色预览
      theme: attributes.value.theme === "auto" ? "light" : attributes.value.theme,
    });
    mountedViewer.value = true;
    loading.value = false;
    errorMessage.value = "";
  } catch (error) {
    loading.value = false;
    errorMessage.value =
      error instanceof Error ? error.message : "3D 运行时加载失败";
  }
}

/** 展开 / 收起设置面板（面板就地渲染在节点内部，不用弹窗） */
function handleToggleSettings() {
  if (!showSettings.value) {
    const pos = props.getPos();
    if (typeof pos === "number") {
      selectThreeModel(props.editor, pos);
    }
  }
  showSettings.value = !showSettings.value;
}

function handlePickModel(item: { url: string; name: string }) {
  applyModel(update, item);
  pickingModel.value = false;
  pickingMaterial.value = false;
}

function handlePickMaterial(item: { url: string }) {
  applyMaterial(update, item);
  pickingMaterial.value = false;
}

onMounted(() => {
  void mountViewer();
});

watch(signature, async () => {
  // 等 DOM 更新完再挂载：刚选完模型时容器可能还没渲染出来
  await nextTick();
  void mountViewer();
});

/**
 * 进入选择模式时释放已经挂载的运行时。
 *
 * 选择模式下画布会被卸载，如果不释放，旧的 WebGL 上下文会一直挂着，
 * 反复「更换模型」几次就可能把浏览器的 WebGL 上下文用光。
 */
watch([showModelPicker, pickingMaterial], ([modelPicker, materialPicker]) => {
  if (!modelPicker && !materialPicker) return;
  const element = container.value;
  if (element) {
    window.Halo3D?.unmount(element);
  }
  mountedViewer.value = false;
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

    <!-- 选模型：直接渲染在节点内部，不经过任何弹窗 -->
    <AttachmentPickPanel
      v-if="showModelPicker"
      :extensions="MODEL_EXTENSIONS"
      :title="hasModel ? '更换模型文件' : '选择模型文件'"
      :on-pick="handlePickModel"
      :on-cancel="hasModel ? () => (pickingModel = false) : undefined"
    />

    <!-- 选材质：同样内联 -->
    <AttachmentPickPanel
      v-else-if="pickingMaterial"
      :extensions="MATERIAL_EXTENSIONS"
      title="选择材质文件（.mtl）"
      :on-pick="handlePickMaterial"
      :on-cancel="() => (pickingMaterial = false)"
    />

    <template v-else>
      <div
        v-show="!showModelPicker && !pickingMaterial"
        ref="container"
        class="halo-3d-model halo-3d-node-view__container"
        :style="{ height: attributes.height }"
      />
      <p
        v-if="loading && !showModelPicker && !pickingMaterial"
        class="halo-3d-node-view__status"
      >
        正在加载 3D 运行时…
      </p>
      <p
        v-else-if="errorMessage && !showModelPicker && !pickingMaterial"
        class="halo-3d-node-view__status halo-3d-node-view__status--error"
      >
        {{ errorMessage }}
      </p>
    </template>

    <div v-if="showSettings" class="halo-3d-node-view__settings-panel">
      <ThreeModelSettingsPanel
        :editor="props.editor"
        :model="attributes"
        :apply="update"
        :on-replace="() => (pickingModel = true)"
        :on-close="() => (showSettings = false)"
      />
      <div v-if="canPickMaterial" class="halo-3d-node-view__extra">
        <button
          class="halo-3d-node-view__link"
          type="button"
          @click="pickingMaterial = true"
        >
          {{ attributes.mtlSrc ? "更换材质文件（.mtl）" : "选择材质文件（.mtl）" }}
        </button>
        <span v-if="attributes.mtlSrc" class="halo-3d-node-view__mtl">
          已设置材质
        </span>
      </div>
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
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding: 12px;
  background-color: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 6%);
}

.halo-3d-node-view__extra {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}

.halo-3d-node-view__link {
  padding: 0;
  font-size: 12px;
  color: #047857;
  cursor: pointer;
  background: none;
  border: none;
}

.halo-3d-node-view__link:hover {
  text-decoration: underline;
}

.halo-3d-node-view__mtl {
  font-size: 12px;
  color: #9ca3af;
}
</style>
