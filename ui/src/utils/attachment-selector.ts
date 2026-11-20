import type { Attachment } from "@halo-dev/api-client";
import { Toast } from "@halo-dev/components";
import type { AttachmentLike } from "@halo-dev/console-shared";
import type { EditorLike } from "@/utils/editor-type";
import { getExtension } from "@/utils/model-file";

/**
 * 附件选择结果。
 *
 * 统一成「URL + 文件名」，这样上层不需要关心 Halo 返回的是
 * `Attachment` 对象还是字符串形式的附件。
 */
export interface PickedAttachment {
  url: string;
  name: string;
}

/**
 * 传给 Halo 附件选择器的「媒体类型」过滤值。
 *
 * ⚠ 这里必须同时满足 Halo 两端的匹配规则：
 *
 * 1. **服务端**（`SearchRequest`）：把 `/*` 换成 `/` 后做**前缀匹配**；
 *    `model/*` → `model/`，能命中 `model/gltf-binary` 与 `model/gltf+json`；
 * 2. **客户端**（`matchMediaTypes`）：把 `*` 换成 `.*` 后做**正则匹配**；
 *    `model/*` → `model/.*`，同样能命中上面两个。
 *
 * Halo 用浏览器的 multipart Content-Type 作为 `spec.mediaType`，
 * 未知扩展名（`.obj` / `.mtl` / `.fbx`）会落到 `application/octet-stream`，
 * 因此这里把这三种都列上。
 */
export const MODEL_ACCEPTS = [
  "model/*",
  "application/octet-stream",
  "text/plain",
];

/** 材质文件（`.mtl`）的媒体类型过滤值 */
export const MATERIAL_ACCEPTS = ["application/octet-stream", "text/plain"];

/** 把 Halo 的 `AttachmentLike` 归一化成 `{ url, name }` */
function normalize(item: AttachmentLike): PickedAttachment | undefined {
  if (typeof item === "string") {
    if (!item) return undefined;
    return { url: item, name: item.split("/").pop() || item };
  }

  if ("url" in item) {
    if (!item.url) return undefined;
    return { url: item.url, name: item.type || item.url.split("/").pop() || "" };
  }

  const attachment = item as Attachment;
  const permalink = attachment.status?.permalink;
  if (!permalink) return undefined;

  return {
    url: permalink,
    name: attachment.spec?.displayName || permalink.split("/").pop() || "",
  };
}

export interface PickAttachmentOptions {
  /** 传给 Halo 选择器的媒体类型过滤 */
  accepts: string[];
  /** 允许的文件扩展名（不含点），用于选中后的精确校验 */
  extensions: string[];
  /** 出错时提示给用户看的文件类型描述，例如「OBJ / FBX / GLB」 */
  label: string;
}

/**
 * 调用 **Halo 自带的附件选择器** 选一个文件。
 *
 * Halo 的默认编辑器里已经挂载了 `AttachmentSelectorModal`，
 * 并通过全局编辑器命令 `openAttachmentSelector` 暴露出来
 * （Halo 2.21.7 源码：`ui/src/components/editor/DefaultEditor.vue`）。
 * 插件直接复用它，好处是：
 *
 * - 弹窗由 Halo 自己渲染，样式、层级、遮罩全部正确；
 * - 附件分组、策略、搜索、分页、上传等功能开箱即用；
 * - 不需要插件自己再造一个附件列表 UI。
 *
 * ⚠ 注意：Halo 的这个命令**只在「确认选择」时回调**，点「取消」不会回调。
 * 所以对于**必选**的场景（本函数）没有问题——用户取消时 Promise 一直挂着，
 * 上层的「插入」流程自然就不会继续，等价于「用户取消了」；
 * 对于**可选**的场景，请不要 await 本函数的返回值，
 * 而是把它当成「选到了才回调」的事件源使用。
 *
 * @returns 选中的附件；用户取消时 Promise 不会结束（见上面的说明）
 */
export function pickAttachment(
  editor: EditorLike,
  options: PickAttachmentOptions
): Promise<PickedAttachment | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value?: PickedAttachment) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const commands = editor.commands as unknown as {
      openAttachmentSelector?: (
        callback: (attachments: AttachmentLike[]) => void,
        selectorOptions?: {
          accepts?: string[];
          min?: number;
          max?: number;
        }
      ) => boolean;
    };

    if (typeof commands.openAttachmentSelector !== "function") {
      console.error(
        "[halo-plugin-3d] 当前 Halo 版本没有 openAttachmentSelector 命令，无法打开附件选择器"
      );
      Toast.error("当前 Halo 版本不支持附件选择器，请升级 Halo 后重试");
      done(undefined);
      return;
    }

    try {
      commands.openAttachmentSelector(
        (attachments: AttachmentLike[]) => {
          const picked = attachments?.[0];
          if (!picked) {
            done(undefined);
            return;
          }

          const normalized = normalize(picked);
          if (!normalized) {
            console.error("[halo-plugin-3d] 所选附件缺少 permalink", picked);
            Toast.error("所选附件还没有生成访问地址，请稍后重试");
            done(undefined);
            return;
          }

          const extension = getExtension(normalized.name || normalized.url);
          if (!options.extensions.includes(extension)) {
            Toast.error(`请选择 ${options.label} 文件`);
            done(undefined);
            return;
          }

          done(normalized);
        },
        {
          accepts: options.accepts,
          min: 1,
          max: 1,
        }
      );
    } catch (error) {
      console.error("[halo-plugin-3d] 打开附件选择器失败", error);
      Toast.error("打开附件选择器失败，请查看浏览器控制台");
      done(undefined);
    }
  });
}
