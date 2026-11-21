<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import { listAttachments, type AttachmentItem } from "@/utils/attachment-api";

/**
 * 附件选择面板（**内联渲染，不是弹窗**）。
 *
 * 为什么不用弹窗：
 *
 * 1. Halo 官方文档里，`ExtensionOptions` 只公开 5 个扩展点
 *    （toolbar / commandMenu / bubbleMenu / toolbox / draggable），
 *    **没有**任何"打开附件选择器"的公开 API；
 *    `editor.commands.openAttachmentSelector` 是 Halo 控制台
 *    `DefaultEditor.vue` 内部的私有命令，不属于插件契约。
 * 2. 实测在控制台里调用它并不会把选择器渲染出来（模态层依赖的样式/层级
 *    在小部件场景下不可靠）。
 *
 * 所以这里改成**把选择面板直接渲染在节点内部**：
 * 它属于编辑器文档流的一部分，不依赖任何浮层、遮罩或第三方弹窗样式，
 * 只要能渲染节点视图就一定能看到它。
 *
 * 这也是 Halo 官方示例插件（`plugin-text-diagram`）的做法：
 * 点击工具箱后同步插入节点，后续交互全部在节点视图内完成。
 */
const props = withDefaults(
  defineProps<{
    /** 允许的扩展名（不含点） */
    extensions: string[];
    /** 面板标题 */
    title?: string;
    /** 选中某个文件 */
    onPick?: (item: AttachmentItem) => void;
    /** 取消 */
    onCancel?: () => void;
  }>(),
  {
    title: "选择模型文件",
    onPick: undefined,
    onCancel: undefined,
  }
);

const keyword = ref("");
const items = ref<AttachmentItem[]>([]);
const loading = ref(false);
const errorMessage = ref("");
const page = ref(1);

async function load() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await listAttachments({
      keyword: keyword.value,
      extensions: props.extensions,
      page: page.value,
    });
    items.value = result.items;
  } catch (error) {
    console.error("[halo-plugin-3d] 读取附件列表失败", error);
    errorMessage.value =
      error instanceof Error ? error.message : "读取附件列表失败";
    items.value = [];
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = 1;
  void load();
}

function handlePrev() {
  if (page.value <= 1) return;
  page.value -= 1;
  void load();
}

function handleNext() {
  page.value += 1;
  void load();
}

watch(
  () => props.extensions,
  () => {
    void load();
  }
);

onMounted(() => {
  void load();
});

function formatSize(size?: number): string {
  if (size === undefined || size === null) return "";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}
</script>

<template>
  <div class="halo-3d-pick">
    <div class="halo-3d-pick__head">
      <strong class="halo-3d-pick__title">{{ props.title }}</strong>
      <span class="halo-3d-pick__hint">
        只显示 {{ props.extensions.map((e) => "." + e).join(" / ") }} 文件
      </span>
    </div>

    <div class="halo-3d-pick__bar">
      <input
        v-model="keyword"
        class="halo-3d-pick__search"
        type="text"
        placeholder="按文件名搜索…"
        @keyup.enter="handleSearch"
      />
      <button class="halo-3d-pick__btn" type="button" @click="handleSearch">
        搜索
      </button>
      <button
        v-if="props.onCancel"
        class="halo-3d-pick__btn"
        type="button"
        @click="props.onCancel()"
      >
        取消
      </button>
    </div>

    <div v-if="loading" class="halo-3d-pick__state">正在读取附件…</div>
    <div v-else-if="errorMessage" class="halo-3d-pick__state halo-3d-pick__state--error">
      {{ errorMessage }}
    </div>
    <div v-else-if="!items.length" class="halo-3d-pick__state">
      没有找到符合条件的文件。<br />
      请先在 Halo 后台的「附件」里上传模型文件，或换个关键字试试。
    </div>
    <ul v-else class="halo-3d-pick__list">
      <li
        v-for="item in items"
        :key="item.url"
        class="halo-3d-pick__item"
        @click="props.onPick?.(item)"
      >
        <span class="halo-3d-pick__ext">
          {{ (item.name.split(".").pop() || "").toUpperCase() }}
        </span>
        <span class="halo-3d-pick__name" :title="item.name">{{ item.name }}</span>
        <span class="halo-3d-pick__size">{{ formatSize(item.size) }}</span>
      </li>
    </ul>

    <div v-if="items.length" class="halo-3d-pick__foot">
      <button
        class="halo-3d-pick__btn"
        type="button"
        :disabled="page <= 1"
        @click="handlePrev"
      >
        上一页
      </button>
      <span class="halo-3d-pick__page">第 {{ page }} 页</span>
      <button
        class="halo-3d-pick__btn"
        type="button"
        :disabled="items.length < 100"
        @click="handleNext"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 全部用显式样式，不依赖任何 Halo 的弹窗 / 布局类，避免被外部样式影响 */
.halo-3d-pick {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  font-size: 13px;
  color: #1f2937;
  background-color: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
}

.halo-3d-pick__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}

.halo-3d-pick__title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.halo-3d-pick__hint {
  font-size: 12px;
  color: #6b7280;
}

.halo-3d-pick__bar {
  display: flex;
  gap: 8px;
}

.halo-3d-pick__search {
  flex: 1 1 auto;
  min-width: 0;
  padding: 6px 10px;
  font-size: 13px;
  color: #1f2937;
  background-color: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
}

.halo-3d-pick__search:focus {
  border-color: #4ccba0;
}

.halo-3d-pick__btn {
  flex: none;
  padding: 6px 12px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  background-color: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

.halo-3d-pick__btn:hover:not(:disabled) {
  background-color: #f3f4f6;
}

.halo-3d-pick__btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.halo-3d-pick__state {
  padding: 20px 8px;
  font-size: 13px;
  line-height: 1.7;
  color: #6b7280;
  text-align: center;
}

.halo-3d-pick__state--error {
  color: #dc2626;
}

.halo-3d-pick__list {
  max-height: 260px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.halo-3d-pick__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
}

.halo-3d-pick__item:last-child {
  border-bottom: none;
}

.halo-3d-pick__item:hover {
  background-color: #f0fdf9;
}

.halo-3d-pick__ext {
  flex: none;
  min-width: 46px;
  padding: 2px 6px;
  font-size: 11px;
  color: #047857;
  text-align: center;
  background-color: #ecfdf5;
  border-radius: 4px;
}

.halo-3d-pick__name {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.halo-3d-pick__size {
  flex: none;
  font-size: 12px;
  color: #9ca3af;
}

.halo-3d-pick__foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
}
</style>
