import { clearSession, getSession } from "./session";

export const API_URL = import.meta.env.VITE_API_URL ?? "";
export const TIMEOUT_SYNC_MS = 8_000;
export const TIMEOUT_FLUSH_MS = 20_000;
export const EVENTO_TERMOS_NAO_ACEITOS = "termos-nao-aceitos";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public codigo?: string,
  ) {
    super(message);
  }
}

interface OpcoesRequisicao {
  timeoutMs?: number;
}

async function request<T>(method: string, path: string, body?: unknown, opcoes?: OpcoesRequisicao): Promise<T> {
  const token = getSession()?.accessToken;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const timeoutMs = opcoes?.timeoutMs;
  const controller = timeoutMs ? new AbortController() : undefined;
  const timer = controller && timeoutMs ? window.setTimeout(() => controller.abort(), timeoutMs) : undefined;
  const estourou = () => new ApiError("Tempo de resposta esgotado.", 0, "TIMEOUT");

  let res: Response;
  let data: any = null;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });
    data = await res.json().catch(() => null);
  } catch {
    throw controller?.signal.aborted
      ? estourou()
      : new ApiError("Não foi possível conectar ao servidor. Verifique sua conexão.", 0);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
  if (controller?.signal.aborted) throw estourou();

  if (res.status === 401 && data?.codigo === "SESSAO_EXPIRADA") {
    clearSession();
    window.location.assign("/login?sessao=expirada");
  }

  if (res.status === 403 && data?.codigo === "TERMOS_NAO_ACEITOS") {
    window.dispatchEvent(new CustomEvent(EVENTO_TERMOS_NAO_ACEITOS));
  }

  if (!res.ok) {
    throw new ApiError((data?.message ?? data?.error) ?? "Algo deu errado. Tente novamente.", res.status, data?.codigo);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opcoes?: OpcoesRequisicao) => request<T>("GET", path, undefined, opcoes),
  post: <T>(path: string, body: unknown, opcoes?: OpcoesRequisicao) => request<T>("POST", path, body, opcoes),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};
