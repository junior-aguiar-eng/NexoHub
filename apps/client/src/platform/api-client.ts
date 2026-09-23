export interface UploadResponse {
  task_id: string;
  files: string[];
  thumbnails: string[];
  tool_id: string;
}

export interface TaskStatusResponse {
  status: "PENDING" | "PROGRESS" | "SUCCESS" | "FAILURE";
  percent: number;
  message?: string;
  result?: {
    output_filename: string;
    file_size: number;
    orig_size?: number;
    saved_bytes?: number;
    saved_percent?: number;
    mime_type: string;
  };
  error?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function uploadToolFiles(toolId: string, files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch(`${API_BASE}/api/v1/tools/${toolId}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Falha no upload (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

export async function startToolProcessing(
  toolId: string,
  taskId: string,
  params: Record<string, unknown> = {},
): Promise<{ task_id: string; status: string }> {
  const response = await fetch(`${API_BASE}/api/v1/tools/${toolId}/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      task_id: taskId,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao iniciar processamento: ${await response.text()}`);
  }

  return response.json();
}

export function subscribeTaskProgress(
  taskId: string,
  onProgress: (status: TaskStatusResponse) => void,
  onError: (error: Error) => void,
): () => void {
  const streamUrl = `${API_BASE}/api/v1/tasks/${taskId}/stream`;
  const eventSource = new EventSource(streamUrl);

  eventSource.onmessage = (event) => {
    try {
      const data: TaskStatusResponse = JSON.parse(event.data);
      onProgress(data);
      if (data.status === "SUCCESS" || data.status === "FAILURE") {
        eventSource.close();
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error("Erro ao decodificar progresso"));
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    // Fallback para polling se SSE falhar
    let active = true;
    const interval = setInterval(async () => {
      if (!active) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/tasks/${taskId}/status`);
        if (res.ok) {
          const data: TaskStatusResponse = await res.json();
          onProgress(data);
          if (data.status === "SUCCESS" || data.status === "FAILURE") {
            clearInterval(interval);
          }
        }
      } catch (err) {
        clearInterval(interval);
        onError(err instanceof Error ? err : new Error("Erro de conexão com o servidor"));
      }
    }, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  };

  return () => {
    eventSource.close();
  };
}

export function getTaskDownloadUrl(taskId: string): string {
  return `${API_BASE}/api/v1/tasks/${taskId}/download`;
}

export function getFullThumbnailUrl(relativePath: string): string {
  if (relativePath.startsWith("http")) return relativePath;
  return `${API_BASE}${relativePath}`;
}
