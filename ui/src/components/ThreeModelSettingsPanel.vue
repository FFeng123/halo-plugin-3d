<script lang="ts" setup>
import { reactive, watch } from "vue";
import { DEFAULT_HEIGHT, HEIGHT_PRESETS, WIDTH_PRESETS } from "@/constants";
import type {
  ThreeModelAttributes,
  ThreeModelBackground,
  ThreeModelTheme,
} from "@/types";
import { THREE_MODEL_NODE_NAME } from "@/utils/three-model-node";
import type { EditorLike } from "@/utils/editor-type";

/**
 * 3D 模型设置面板。
 *
 * 这个面板**不使用任何弹窗**，而是直接渲染在两个位置：
 *
 * 1. **编辑器悬浮菜单的下拉层**——Halo 的 `BubbleItem.action` 可以返回组件，
 *    返回后组件会渲染在气泡菜单的 popper 里（见 Halo 2.21.7 源码
 *    `ui/packages/editor/src/components/bubble/BubbleItem.vue`）；
 * 2. **节点视图内部**——点击模型右上角的齿轮按钮后原地展开。
 *
 * 这样做的好处是彻底避开了「自己造弹窗」的各种坑：
 * 面板由 Halo 自己的 Vue 应用渲染，样式和层级天然正确。
 */
const props = withDefaults(
  defineProps<{
    /** 编辑器实例，用于读取属性 */
    editor: EditorLike;
    /** 初始属性；不传则从编辑器当前选中的节点读取 */
    model?: Partial<ThreeModelAttributes>;
    /** 写入属性的方式；不传则直接调用编辑器的 updateAttributes */
    apply?: (patch: Partial<ThreeModelAttributes>) => void;
    /** 点击「更换模型」 */
    onReplace?: () => void;
    /** 点击「完成」 */
    onClose?: () => void;
  }>(),
  {
    model: undefined,
    apply: undefined,
    onReplace: undefined,
    onClose: undefined,
  }
);

const THEME_OPTIONS: { value: ThreeModelTheme; label: string }[] = [
  { value: "auto", label: "跟随站点" },
  { value: "light", label: "亮色" },
  { value: "dark", label: "暗色" },
];

const BACKGROUND_OPTIONS: { value: ThreeModelBackground; label: string }[] = [
  { value: "none", label: "透明" },
  { value: "solid", label: "纯色" },
  { value: "gradient", label: "渐变" },
];

function readInitial(): Partial<ThreeModelAttributes> {
  if (props.model) return props.model;
  try {
    return props.editor.getAttributes(THREE_MODEL_NODE_NAME) as Partial<
      ThreeModelAttributes
    >;
  } catch (error) {
    console.error("[halo-plugin-3d] 读取 3D 模型属性失败", error);
    return {};
  }
}

const draft = reactive<ThreeModelAttributes>({
  src: "",
  mtlSrc: "",
  name: "",
  width: "100%",
  height: DEFAULT_HEIGHT,
  theme: "auto",
  autoRotate: true,
  background: "solid",
  grid: true,
  controls: true,
  ...readInitial(),
});

/** 只有这些字段是可配置的 */
const CONFIGURABLE_KEYS = [
  "theme",
  "autoRotate",
  "background",
  "grid",
  "controls",
  "width",
  "height",
] as const;

function pickConfigurable(): Partial<ThreeModelAttributes> {
  const result: Partial<ThreeModelAttributes> = {};
  CONFIGURABLE_KEYS.forEach((key) => {
    result[key] = draft[key] as never;
  });
  return result;
}

/** 写入属性 */
function applyPatch(patch: Partial<ThreeModelAttributes>) {
  if (props.apply) {
    props.apply(patch);
    return;
  }
  try {
    // 不加 focus()：用户正在面板里操作输入框，抢焦点会把输入打断
    props.editor.chain().updateAttributes(THREE_MODEL_NODE_NAME, patch).run();
  } catch (error) {
    console.error("[halo-plugin-3d] 更新 3D 模型属性失败", error);
  }
}

/** 任何改动都实时同步到编辑器 */
watch(
  draft,
  () => {
    applyPatch(pickConfigurable());
  },
  { deep: true }
);
</script>

<template>
  <div class="halo-3d-settings">
    <div class="halo-3d-settings__body">
      <section class="halo-3d-settings__section">
        <h4 class="halo-3d-settings__title">模型</h4>
        <div class="halo-3d-settings__row">
          <span class="halo-3d-settings__filename" :title="draft.name">
            {{ draft.name || "未命名模型" }}
          </span>
          <button
            class="halo-3d-settings__button"
            type="button"
            @click="props.onReplace?.()"
          >
            更换
          </button>
        </div>
      </section>

      <section class="halo-3d-settings__section">
        <h4 class="halo-3d-settings__title">外观</h4>

        <div class="halo-3d-settings__row">
          <span class="halo-3d-settings__label">主题</span>
          <div class="halo-3d-settings__group">
            <button
              v-for="option in THEME_OPTIONS"
              :key="option.value"
              class="halo-3d-settings__chip"
              type="button"
              :class="{ 'halo-3d-settings__chip--active': draft.theme === option.value }"
              @click="draft.theme = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="halo-3d-settings__row">
          <span class="halo-3d-settings__label">背景</span>
          <div class="halo-3d-settings__group">
            <button
              v-for="option in BACKGROUND_OPTIONS"
              :key="option.value"
              class="halo-3d-settings__chip"
              type="button"
              :class="{
                'halo-3d-settings__chip--active': draft.background === option.value,
              }"
              @click="draft.background = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="halo-3d-settings__row">
          <span class="halo-3d-settings__label">显示网格</span>
          <button
            class="halo-3d-settings__switch"
            type="button"
            role="switch"
            :aria-checked="draft.grid"
            :class="{ 'halo-3d-settings__switch--on': draft.grid }"
            @click="draft.grid = !draft.grid"
          >
            <span class="halo-3d-settings__knob" />
          </button>
        </div>
      </section>

      <section class="halo-3d-settings__section">
        <h4 class="halo-3d-settings__title">交互</h4>

        <div class="halo-3d-settings__row">
          <span class="halo-3d-settings__label">自动旋转</span>
          <button
            class="halo-3d-settings__switch"
            type="button"
            role="switch"
            :aria-checked="draft.autoRotate"
            :class="{ 'halo-3d-settings__switch--on': draft.autoRotate }"
            @click="draft.autoRotate = !draft.autoRotate"
          >
            <span class="halo-3d-settings__knob" />
          </button>
        </div>

        <div class="halo-3d-settings__row">
          <span class="halo-3d-settings__label">手动拖动 / 缩放</span>
          <button
            class="halo-3d-settings__switch"
            type="button"
            role="switch"
            :aria-checked="draft.controls"
            :class="{ 'halo-3d-settings__switch--on': draft.controls }"
            @click="draft.controls = !draft.controls"
          >
            <span class="halo-3d-settings__knob" />
          </button>
        </div>
      </section>

      <section class="halo-3d-settings__section">
        <h4 class="halo-3d-settings__title">尺寸</h4>

        <div class="halo-3d-settings__row">
          <span class="halo-3d-settings__label">宽度</span>
          <div class="halo-3d-settings__group">
            <button
              v-for="preset in WIDTH_PRESETS"
              :key="preset"
              class="halo-3d-settings__chip"
              type="button"
              :class="{ 'halo-3d-settings__chip--active': draft.width === preset }"
              @click="draft.width = preset"
            >
              {{ preset }}
            </button>
          </div>
        </div>
        <div class="halo-3d-settings__row">
          <span class="halo-3d-settings__label"></span>
          <input
            v-model="draft.width"
            class="halo-3d-settings__input"
            type="text"
            placeholder="自定义宽度，如 720px"
          />
        </div>

        <div class="halo-3d-settings__row">
          <span class="halo-3d-settings__label">高度</span>
          <div class="halo-3d-settings__group">
            <button
              v-for="preset in HEIGHT_PRESETS"
              :key="preset"
              class="halo-3d-settings__chip"
              type="button"
              :class="{ 'halo-3d-settings__chip--active': draft.height === preset }"
              @click="draft.height = preset"
            >
              {{ preset }}
            </button>
          </div>
        </div>
        <div class="halo-3d-settings__row">
          <span class="halo-3d-settings__label"></span>
          <input
            v-model="draft.height"
            class="halo-3d-settings__input"
            type="text"
            placeholder="自定义高度，如 500px"
          />
        </div>
      </section>
    </div>

    <div v-if="props.onClose" class="halo-3d-settings__footer">
      <button
        class="halo-3d-settings__button halo-3d-settings__button--primary"
        type="button"
        @click="props.onClose()"
      >
        完成
      </button>
    </div>
  </div>
</template>

<style scoped>
.halo-3d-settings {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  gap: 10px;
  color: #374151;
  font-size: 13px;
}

.halo-3d-settings__body {
  flex: 1 1 auto;
  /* flex 滚动容器必须显式 min-height: 0，否则内容会撑破容器 */
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-right: 4px;
  overflow-y: auto;
}

.halo-3d-settings__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.halo-3d-settings__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.halo-3d-settings__row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 26px;
}

.halo-3d-settings__label {
  flex: none;
  width: 96px;
  font-size: 13px;
  color: #4b5563;
}

.halo-3d-settings__filename {
  flex: 1 1 auto;
  overflow: hidden;
  font-size: 13px;
  color: #1f2937;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.halo-3d-settings__group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.halo-3d-settings__chip {
  padding: 4px 10px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  background-color: #fff;
  border: 1px solid #d1d5db;
  border-radius: 999px;
}

.halo-3d-settings__chip:hover {
  background-color: #f3f4f6;
}

.halo-3d-settings__chip--active {
  color: #047857;
  background-color: #ecfdf5;
  border-color: #4ccba0;
}

.halo-3d-settings__switch {
  position: relative;
  flex: none;
  width: 38px;
  height: 21px;
  padding: 0;
  cursor: pointer;
  background-color: #d1d5db;
  border: none;
  border-radius: 999px;
  transition: background-color 0.15s ease;
}

.halo-3d-settings__switch--on {
  background-color: #4ccba0;
}

.halo-3d-settings__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 17px;
  height: 17px;
  background-color: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgb(0 0 0 / 25%);
  transition: transform 0.15s ease;
}

.halo-3d-settings__switch--on .halo-3d-settings__knob {
  transform: translateX(17px);
}

.halo-3d-settings__input {
  flex: 1 1 auto;
  max-width: 200px;
  padding: 5px 10px;
  font-size: 13px;
  color: #1f2937;
  background-color: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
}

.halo-3d-settings__input:focus {
  border-color: #4ccba0;
}

.halo-3d-settings__button {
  flex: none;
  padding: 5px 10px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  background-color: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

.halo-3d-settings__button:hover {
  background-color: #f3f4f6;
}

.halo-3d-settings__button--primary {
  color: #fff;
  background-color: #4ccba0;
  border-color: #4ccba0;
}

.halo-3d-settings__button--primary:hover {
  background-color: #3fb590;
}

.halo-3d-settings__footer {
  display: flex;
  flex: none;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}
</style>
