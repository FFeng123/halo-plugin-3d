import { consoleApiClient, coreApiClient } from "@halo-dev/api-client";
import { getExtension } from "@/utils/model-file";

/** 归一化后的附件条目 */
export interface AttachmentItem {
  /** 附件名（含扩展名） */
  name: string;
  /** 访问地址（permalink） */
  url: string;
  /** 字节数 */
  size?: number;
}

/** 存储策略 */
export interface AttachmentPolicy {
  /** 策略名（上传时要传给接口） */
  name: string;
  /** 展示名 */
  displayName: string;
}

const PAGE_SIZE = 100;

/**
 * Halo 自带的本地存储策略名。
 *
 * 见 Halo 源码 `application/src/main/resources/extensions/attachment-local-policy.yaml`：
 * `metadata.name: default-policy`。
 */
export const DEFAULT_POLICY_NAME = "default-policy";

/**
 * 查询附件列表。
 *
 * 用的是 Halo 公开的控制台 API
 * （`consoleApiClient.storage.attachment.searchAttachments`），
 * 和 Halo 自己的附件选择器走的是同一个接口。
 *
 * ⚠ 这里**故意不传 `accepts`**：
 * 服务端是按 `spec.mediaType` 做前缀匹配的，而 `.obj` / `.mtl` / `.fbx`
 * 这些文件浏览器上报的媒体类型并不稳定（多半是 `application/octet-stream`），
 * 交给服务端过滤反而容易把要的文件滤掉。所以统一取回来，
 * 再按**文件扩展名**在本地精确筛选——这也是唯一可靠的判据。
 */
export async function listAttachments(options: {
  keyword?: string;
  extensions: string[];
  page?: number;
}): Promise<{ items: AttachmentItem[]; page: number }> {
  const { keyword = "", extensions, page = 1 } = options;

  const response = await consoleApiClient.storage.attachment.searchAttachments({
    page,
    size: PAGE_SIZE,
    keyword: keyword.trim() || undefined,
    sort: ["metadata.creationTimestamp,desc"],
  });

  const items = (response.data.items ?? [])
    .map((attachment) => {
      const name = attachment.spec?.displayName ?? "";
      const url = attachment.status?.permalink ?? "";
      return {
        name,
        url,
        size: attachment.spec?.size,
      };
    })
    .filter(
      (item) =>
        item.url && extensions.includes(getExtension(item.name || item.url))
    );

  return { items, page };
}

/**
 * 列出站点可用的存储策略。
 *
 * 与 Halo 控制台「附件 → 存储策略」用的是同一个接口
 * （`coreApiClient.storage.policy.listPolicy`）。
 */
export async function listPolicies(): Promise<AttachmentPolicy[]> {
  const response = await coreApiClient.storage.policy.listPolicy({
    page: 1,
    size: 50,
  });
  return (response.data.items ?? []).map((policy) => ({
    name: policy.metadata.name,
    displayName: policy.spec?.displayName || policy.metadata.name,
  }));
}

/**
 * 挑一个可用的存储策略。
 *
 * 优先用站点上的第一个策略；没有就退回 Halo 自带的默认策略名。
 */
export async function resolvePolicyName(): Promise<string> {
  try {
    const policies = await listPolicies();
    const preferred =
      policies.find((policy) => policy.name === DEFAULT_POLICY_NAME) ??
      policies[0];
    return preferred?.name ?? DEFAULT_POLICY_NAME;
  } catch (error) {
    console.warn("[halo-plugin-3d] 读取存储策略失败，使用默认策略", error);
    return DEFAULT_POLICY_NAME;
  }
}

/**
 * 上传附件到 Halo。
 *
 * 走的是 Halo 公开的控制台 API
 * （`consoleApiClient.storage.attachment.uploadAttachment`），
 * 与控制台「附件 → 上传」是同一条链路，因此同样受「附件存储策略」约束。
 */
export async function uploadAttachment(
  file: File,
  policyName: string = DEFAULT_POLICY_NAME
): Promise<AttachmentItem> {
  const response = await consoleApiClient.storage.attachment.uploadAttachment({
    file,
    policyName,
  });
  const attachment = response.data;
  return {
    name: attachment.spec?.displayName ?? file.name,
    url: attachment.status?.permalink ?? "",
    size: attachment.spec?.size,
  };
}

/** 取出服务端返回的错误正文，便于按错误码定位原因 */
function extractErrorBody(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const candidate = error as {
    response?: { data?: unknown };
    data?: unknown;
    message?: string;
  };
  const data = candidate.response?.data ?? candidate.data;
  if (data) {
    if (typeof data === "string") return data;
    try {
      return JSON.stringify(data);
    } catch {
      /* 忽略序列化失败 */
    }
  }
  return candidate.message ?? String(error);
}

/** 取出 HTTP 状态码 */
function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { response?: { status?: number } };
  return candidate.response?.status;
}

/**
 * 把上传失败翻译成**可操作**的提示。
 *
 * Halo 的本地存储策略（`LocalAttachmentUploadHandler.validateFile`）只在
 * 「文件类型限制」**非空**时才会做校验，而且校验分两步：
 *
 * 1. `FileTypeDetectUtils.isValidExtensionForMime()` —— 用 Tika 检测文件真实类型，
 *    再反查这个类型对应的规范扩展名，跟文件的实际扩展名比对；
 *    对不上就报 `fileTypeNotMatch`（HTTP 415）。
 *    ⚠ Tika 认识 `.glb`（model/gltf-binary）和 `.fbx`（application/x-fbx），
 *    但**不认识** `.gltf` / `.obj` / `.mtl`，所以这三个扩展名在这一步就会被拒。
 * 2. `FileCategoryMatcher` —— 文件类型必须落在允许的类别里（ALL / IMAGE / SVG /
 *    VIDEO / AUDIO / DOCUMENT / ARCHIVE），否则报 `fileTypeNotSupported`（HTTP 415）。
 *
 * ⇒ **只要「文件类型限制」一个都不勾，整段校验就会被跳过，任何扩展名都能上传。**
 */
export function describeUploadError(error: unknown): string {
  const body = extractErrorBody(error);
  const status = extractStatus(error);

  if (body.includes("fileTypeNotMatch")) {
    return (
      "上传被 Halo 的「附件存储策略」拒绝了：文件的 MIME 类型与扩展名不匹配。\n" +
      "请到：控制台 → 内容 → 附件 → 右上角「存储策略」→ 选中「本地存储」→ 编辑，" +
      "把「文件类型限制」里的选项**全部取消勾选**（留空）后保存，再重新上传。\n" +
      "（原因：Halo 勾选了任何一项文件类型限制后，就会额外校验 MIME 与扩展名是否一致，" +
      "而 .gltf / .obj / .mtl 这类 3D 格式无法通过该校验。）"
    );
  }

  if (body.includes("fileTypeNotSupported")) {
    return (
      "上传被 Halo 的「附件存储策略」拒绝了：文件类型不在允许的列表里。\n" +
      "请到：控制台 → 内容 → 附件 → 右上角「存储策略」→ 选中「本地存储」→ 编辑，" +
      "把「文件类型限制」里的选项**全部取消勾选**（留空）后保存，再重新上传。"
    );
  }

  if (body.includes("fileSizeExceeded")) {
    return (
      "上传被拒绝：文件超过了「附件存储策略」里设置的最大单文件大小。\n" +
      "请到：控制台 → 内容 → 附件 → 右上角「存储策略」→ 选中「本地存储」→ 编辑，" +
      "调大「最大单文件大小」后重试。"
    );
  }

  if (status === 415) {
    return (
      "上传被拒绝（HTTP 415）：多半是「附件存储策略」限制了文件类型。\n" +
      "请到：控制台 → 内容 → 附件 → 右上角「存储策略」→ 选中「本地存储」→ 编辑，" +
      "把「文件类型限制」里的选项**全部取消勾选**（留空）后保存，再重新上传。"
    );
  }

  if (status === 403) {
    return "上传被拒绝（HTTP 403）：当前账号没有附件上传权限，请联系管理员。";
  }

  return error instanceof Error ? error.message : "上传失败";
}
