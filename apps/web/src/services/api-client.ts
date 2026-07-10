import { env } from "@/config/env";

type ApiClientOptions = {
  token?: string | null;
  headers?: Record<string, string>;
};

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export class ApiClientError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

function buildHeaders(options?: ApiClientOptions): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers ?? {}),
  };

  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  return headers;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  if ("detail" in payload) {
    const detail = payload.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String(item.msg);
          }

          return JSON.stringify(item);
        })
        .join(" | ");
    }

    return JSON.stringify(detail);
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}

async function request<TResponse, TBody = unknown>(
  method: HttpMethod,
  path: string,
  body?: TBody,
  options?: ApiClientOptions,
): Promise<TResponse> {
  const baseUrl = env.apiUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  try {
    const response = await fetch(url, {
      method,
      headers: buildHeaders(options),
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      let payload: unknown = null;

      try {
        payload = await response.json();
      } catch {
        payload = await response.text();
      }

      const message = getErrorMessage(
        payload,
        `Error HTTP ${response.status} en ${method} ${normalizedPath}`,
      );

      console.error("[Kadosh API Error]", {
        method,
        url,
        status: response.status,
        payload,
      });

      throw new ApiClientError(message, response.status, payload);
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    console.error("[Kadosh API Network Error]", {
      method,
      url,
      error,
    });

    throw new ApiClientError(
      `No se pudo conectar con el backend. URL llamada: ${url}`,
      0,
      error,
    );
  }
}

export const apiClient = {
  get<TResponse>(
    path: string,
    options?: ApiClientOptions,
  ): Promise<TResponse> {
    return request<TResponse>("GET", path, undefined, options);
  },

  post<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options?: ApiClientOptions,
  ): Promise<TResponse> {
    return request<TResponse, TBody>("POST", path, body, options);
  },

  patch<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options?: ApiClientOptions,
  ): Promise<TResponse> {
    return request<TResponse, TBody>("PATCH", path, body, options);
  },

  delete<TResponse>(
    path: string,
    options?: ApiClientOptions,
  ): Promise<TResponse> {
    return request<TResponse>("DELETE", path, undefined, options);
  },
};
