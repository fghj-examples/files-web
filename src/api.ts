export type FileItem = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  sample: boolean;
  status: "pending" | "ready";
  createdAt: string;
  downloadUrl: string;
  thumbUrl: string | null;
};

export class Api {
  constructor(private token: string) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `${path} answered ${res.status}`);
    }
    return res.json();
  }

  list() {
    return this.call<FileItem[]>("/files");
  }

  // The bytes go straight to MinIO on a presigned URL; the api only ever
  // sees the metadata.
  async upload(file: File): Promise<FileItem> {
    const contentType = file.type || "application/octet-stream";
    const { id, uploadUrl } = await this.call<{ id: string; uploadUrl: string }>(
      "/files",
      {
        method: "POST",
        body: JSON.stringify({ name: file.name, contentType, size: file.size }),
      },
    );
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: file,
    });
    if (!put.ok) throw new Error(`storage refused the upload (${put.status})`);
    return this.call<FileItem>(`/files/${id}/complete`, { method: "POST" });
  }
}
