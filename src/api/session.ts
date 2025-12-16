import { API_BASE_URL } from "../config/api";
import { getAuthToken } from "../utils/auth";

/**
 * Создаёт сессию на бэкенде через cookie
 * Отправляет Firebase ID token, бэкенд устанавливает httpOnly cookie
 */
export async function createSession(): Promise<{ success: boolean; user?: { uid: string; email?: string } }> {
  try {
    const idToken = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include", // Важно для работы cookies
      body: JSON.stringify({ idToken })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("Failed to create session:", error);
    throw error;
  }
}

/**
 * Удаляет сессию (очищает cookie)
 */
export async function clearSession(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/session/logout`, {
      method: "POST",
      credentials: "include"
    });
  } catch (error) {
    console.error("Failed to clear session:", error);
    // Игнорируем ошибки при logout
  }
}


