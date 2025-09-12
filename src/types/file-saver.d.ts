declare module "file-saver" {
  export function saveAs(
    data: Blob | File,
    filename?: string,
    options?: unknown
  ): void;
}
