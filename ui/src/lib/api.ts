class ApiClient {
  private baseUrl: string = "";

  setPort(port: number) {
    this.baseUrl = `http://127.0.0.1:${port}`;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API ${res.status}: ${body}`);
    }
    return res.json();
  }

  async analyze(folders: string[], merge: boolean, output: string) {
    return this.request<{ status: string }>("/api/analyze", {
      method: "POST",
      body: JSON.stringify({ folders, merge, output }),
    });
  }

  async checkFolders(folders: string[]) {
    return this.request<{ jpg_count: number; other_count: number }>("/api/check_folders", {
      method: "POST",
      body: JSON.stringify({ folders }),
    });
  }

  progressStream(): EventSource {
    return new EventSource(`${this.baseUrl}/api/progress`);
  }

  async cancel() {
    return this.request<{ status: string }>("/api/cancel", {
      method: "POST",
    });
  }

  async getPhotos(category?: string, page?: number, limit?: number) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (page != null) params.set("page", String(page));
    if (limit != null) params.set("limit", String(limit));
    const qs = params.toString();
    return this.request<{ photos: Photo[]; total: number; page: number; limit: number }>(
      `/api/photos${qs ? `?${qs}` : ""}`
    );
  }

  thumbnailUrl(photoId: string): string {
    return `${this.baseUrl}/api/photos/${encodeURIComponent(photoId)}/thumbnail`;
  }

  fullUrl(photoId: string): string {
    return `${this.baseUrl}/api/photos/${encodeURIComponent(photoId)}/full`;
  }

  async getPhoto(photoId: string) {
    return this.request<Photo>(`/api/photos/${encodeURIComponent(photoId)}`);
  }

  async getSummary() {
    return this.request<{ keep: number; maybe: number; reject: number; total: number }>(
      "/api/summary"
    );
  }

  async setOverride(photoId: string, destination: string) {
    return this.request<{ status: string }>("/api/override", {
      method: "POST",
      body: JSON.stringify({ photo_id: photoId, destination }),
    });
  }

  async setBatchOverride(photoIds: string[], destination: string) {
    return this.request<{ status: string }>("/api/override/batch", {
      method: "POST",
      body: JSON.stringify({ photo_ids: photoIds, destination }),
    });
  }

  async resetOverride(photoId: string) {
    return this.request<{ status: string }>("/api/override/reset", {
      method: "POST",
      body: JSON.stringify({ photo_id: photoId }),
    });
  }

  async resetAllOverrides() {
    return this.request<{ status: string }>("/api/override/reset-all", {
      method: "POST",
    });
  }

  exportStream(): EventSource {
    return new EventSource(`${this.baseUrl}/api/export`);
  }

  async getExportPreview() {
    return this.request<{
      keep: string[];
      maybe: string[];
      reject: string[];
      total: number;
    }>("/api/export/preview");
  }
}

interface Photo {
  id: string;
  filename: string;
  path: string;
  quality_score: number | null;
  tier: string;
  destination: string;
  sharpness: number | null;
  exposure: number | null;
  contrast: number | null;
  exif_score: number | null;
  iso: number | null;
  shutter_speed: number | null;
  aperture: number | null;
  file_size: number | null;
}

export type { Photo };
export const api = new ApiClient();
