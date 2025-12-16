import type { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";
import { Logger } from "../utils/logger";
import { isFirebaseAuthAvailable } from "../services/firebaseAdmin";
import jwt from "jsonwebtoken";

const COOKIE_SECRET = process.env.COOKIE_SECRET || process.env.JWT_SECRET || "default-secret-change-in-production";
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "session";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 дней

export interface SessionUser {
  uid: string;
  email?: string;
  iat?: number;
  exp?: number;
}

/**
 * Middleware для проверки сессии через cookie
 * 
 * Читает cookie session, проверяет JWT токен
 * При успешной проверке сохраняет req.user
 */
export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Пропускаем OPTIONS запросы
  if (req.method === "OPTIONS") {
    return next();
  }

  const sessionToken = req.cookies?.[COOKIE_NAME];

  if (!sessionToken) {
    Logger.warn("requireSession: missing session cookie", {
      method: req.method,
      path: req.path,
      cookies: Object.keys(req.cookies || {})
    });
    res.status(401).json({
      error: "Unauthorized",
      message: "Session cookie is missing. Please login first."
    });
    return;
  }

  try {
    // Верифицируем JWT токен из cookie
    const decoded = jwt.verify(sessionToken, COOKIE_SECRET) as SessionUser;

    // Проверяем, что Firebase Admin доступен для дополнительной проверки
    if (isFirebaseAuthAvailable()) {
      try {
        // Дополнительная проверка через Firebase Admin (опционально, для безопасности)
        const userRecord = await admin.auth().getUser(decoded.uid);
        
        // Сохраняем информацию о пользователе
        req.user = {
          uid: decoded.uid,
          email: decoded.email || userRecord.email
        };

        Logger.info("requireSession: session verified successfully", {
          uid: decoded.uid,
          email: req.user.email || "not provided",
          method: req.method,
          path: req.path
        });

        next();
        return;
      } catch (firebaseError: any) {
        Logger.warn("requireSession: Firebase user check failed, but JWT is valid", {
          uid: decoded.uid,
          error: firebaseError?.message || String(firebaseError),
          method: req.method,
          path: req.path
        });
        // Продолжаем с JWT данными, даже если Firebase проверка не удалась
      }
    }

    // Если Firebase недоступен, используем только JWT
    req.user = {
      uid: decoded.uid,
      email: decoded.email
    };

    Logger.info("requireSession: session verified (JWT only)", {
      uid: decoded.uid,
      email: decoded.email || "not provided",
      method: req.method,
      path: req.path
    });

    next();
  } catch (error: any) {
    Logger.warn("requireSession: session verification failed", {
      error: error?.message || String(error),
      method: req.method,
      path: req.path,
      tokenPrefix: sessionToken?.substring(0, 20) + "..."
    });

    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired session. Please login again."
    });
  }
}

/**
 * Создаёт JWT токен для сессии
 */
export function createSessionToken(user: { uid: string; email?: string }): string {
  return jwt.sign(
    {
      uid: user.uid,
      email: user.email
    },
    COOKIE_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

/**
 * Устанавливает session cookie
 */
export function setSessionCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "https://shortsai.ru";
  const backendOrigin = process.env.BACKEND_BASE_URL || "https://shortsai-backend-905027425668.us-central1.run.app";
  
  // Для cross-origin cookies (frontend и backend на разных доменах)
  // НЕ устанавливаем domain, чтобы cookie работал для обоих доменов
  // Или используем общий домен, если есть
  
  // Определяем, нужно ли устанавливать domain
  // Если frontend и backend на разных доменах, не устанавливаем domain
  let cookieDomain: string | undefined;
  try {
    const frontendUrl = new URL(frontendOrigin);
    const backendUrl = new URL(backendOrigin);
    
    // Если домены разные, не устанавливаем domain (cookie будет для текущего домена)
    if (frontendUrl.hostname !== backendUrl.hostname) {
      cookieDomain = undefined; // Cookie будет для домена, который установил его (backend)
    } else {
      // Если домены одинаковые, можно установить domain
      cookieDomain = frontendUrl.hostname;
      if (cookieDomain.startsWith("www.")) {
        cookieDomain = cookieDomain.substring(4);
      }
    }
  } catch (e) {
    Logger.warn("setSessionCookie: failed to parse origins", {
      frontendOrigin,
      backendOrigin,
      error: String(e)
    });
    cookieDomain = undefined;
  }

  const cookieOptions: any = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax", // none для cross-origin в production
    maxAge: COOKIE_MAX_AGE,
    path: "/"
  };

  // Устанавливаем domain только если он определён
  if (cookieDomain) {
    cookieOptions.domain = cookieDomain;
  }

  res.cookie(COOKIE_NAME, token, cookieOptions);

  Logger.info("setSessionCookie: cookie set", {
    cookieName: COOKIE_NAME,
    domain: cookieDomain || "not set (cross-origin)",
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    hasToken: !!token,
    frontendOrigin,
    backendOrigin
  });
}

/**
 * Удаляет session cookie
 */
export function clearSessionCookie(res: Response): void {
  const isProduction = process.env.NODE_ENV === "production";
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "https://shortsai.ru";
  const backendOrigin = process.env.BACKEND_BASE_URL || "https://shortsai-backend-905027425668.us-central1.run.app";
  
  let cookieDomain: string | undefined;
  try {
    const frontendUrl = new URL(frontendOrigin);
    const backendUrl = new URL(backendOrigin);
    
    if (frontendUrl.hostname !== backendUrl.hostname) {
      cookieDomain = undefined;
    } else {
      cookieDomain = frontendUrl.hostname;
      if (cookieDomain.startsWith("www.")) {
        cookieDomain = cookieDomain.substring(4);
      }
    }
  } catch (e) {
    cookieDomain = undefined;
  }

  const cookieOptions: any = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/"
  };

  if (cookieDomain) {
    cookieOptions.domain = cookieDomain;
  }

  res.clearCookie(COOKIE_NAME, cookieOptions);

  Logger.info("clearSessionCookie: cookie cleared", {
    cookieName: COOKIE_NAME,
    domain: cookieDomain || "not set"
  });
}

