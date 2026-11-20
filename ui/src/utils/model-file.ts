/**
 * 取出一个文件名（或 URL）的小写扩展名。
 */
export function getExtension(name: string): string {
  if (!name) return "";
  const clean = name.split(/[?#]/)[0];
  const base = clean.substring(clean.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot === -1) return "";
  return base.slice(dot + 1).toLowerCase();
}
