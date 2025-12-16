import { API_BASE_URL } from "../config/api";

/**
 * Утилита для fetch запросов к API с автоматическим добавлением credentials
 * Используется для всех запросов, которые требуют авторизации через cookie
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  return fetch(url, {
    ...options,
    credentials: "include", // Важно для работы cookies
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });
}


