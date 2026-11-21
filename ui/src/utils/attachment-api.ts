import { consoleApiClient } from "@halo-dev/api-client";
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

const PAGE_SIZE = 100;

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
