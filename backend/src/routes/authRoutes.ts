import { Router } from "express";
import { google } from "googleapis";
import * as crypto from "crypto";
import { Logger } from "../utils/logger";
import { saveUserOAuthTokens } from "../repositories/userOAuthTokensRepo";
import { authRequired } from "../middleware/auth";
import { requireSession, setSessionCookie, clearSessionCookie, createSessionToken } from "../middleware/session";
import { generateOAuthState } from "../utils/oauthState";
import * as admin from "firebase-admin";
import { isFirebaseAuthAvailable } from "../services/firebaseAdmin";

const router = Router();

// Создаём OAuth2 клиент
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:8080/api/auth/google/callback";

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_OAUTH_NOT_CONFIGURED: Google OAuth credentials are not configured. " +
      "Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in backend/.env"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Scopes для Google Drive
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive"
];

/**
 * POST /api/auth/session
 * Создаёт сессию через cookie на основе Firebase ID token
 * 
 * Body: { idToken: string }
 * 
 * Валидирует Firebase ID token, создаёт JWT session token,
 * устанавливает httpOnly cookie и возвращает успех
 */
router.post("/session", async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { idToken } = req.body as { idToken?: string };

    Logger.info("POST /api/auth/session: Request received", {
      requestId,
      hasIdToken: !!idToken,
      method: req.method,
      path: req.path,
      origin: req.headers.origin || "none"
    });

    if (!idToken || typeof idToken !== "string") {
      Logger.warn("POST /api/auth/session: Missing idToken", {
        requestId,
        hasIdToken: !!idToken,
        idTokenType: typeof idToken
      });
      return res.status(400).json({
        error: "BAD_REQUEST",
        message: "idToken is required in request body"
      });
    }

    // Проверяем, что Firebase Admin доступен
    if (!isFirebaseAuthAvailable()) {
      Logger.error("POST /api/auth/session: Firebase Admin not available", {
        requestId
      });
      return res.status(503).json({
        error: "AUTH_UNAVAILABLE",
        message: "Authentication service unavailable"
      });
    }

    // Верифицируем Firebase ID token
    let decodedToken: admin.auth.DecodedIdToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
      
      Logger.info("POST /api/auth/session: Firebase token verified", {
        requestId,
        uid: decodedToken.uid,
        email: decodedToken.email || "not provided"
      });
    } catch (verifyError: any) {
      Logger.warn("POST /api/auth/session: Firebase token verification failed", {
        requestId,
        error: verifyError?.message || String(verifyError),
        errorCode: verifyError?.code
      });
      return res.status(401).json({
        error: "INVALID_TOKEN",
        message: "Invalid or expired Firebase ID token"
      });
    }

    // Создаём session token
    const sessionToken = createSessionToken({
      uid: decodedToken.uid,
      email: decodedToken.email
    });

    // Устанавливаем cookie
    setSessionCookie(res, sessionToken);

    Logger.info("POST /api/auth/session: Session created successfully", {
      requestId,
      uid: decodedToken.uid,
      email: decodedToken.email || "not provided",
      cookieSet: true
    });

    return res.json({
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email
      }
    });
  } catch (error: any) {
    Logger.error("POST /api/auth/session: Unexpected error", {
      requestId,
      error: error?.message || String(error),
      errorStack: error?.stack
    });
    
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to create session"
    });
  }
});

/**
 * POST /api/auth/session/logout
 * Удаляет сессию (очищает cookie)
 */
router.post("/session/logout", (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  Logger.info("POST /api/auth/session/logout: Request received", {
    requestId,
    method: req.method,
    path: req.path
  });

  clearSessionCookie(res);

  Logger.info("POST /api/auth/session/logout: Session cleared", {
    requestId
  });

  return res.json({
    success: true,
    message: "Session cleared"
  });
});

/**
 * GET /api/auth/user-id
 * Возвращает userId текущего авторизованного пользователя
 */
router.get("/user-id", authRequired, (req, res) => {
  res.json({
    userId: req.user!.uid,
    email: req.user!.email
  });
});

/**
 * GET /api/auth/google
 * Перенаправляет пользователя на страницу авторизации Google
 * userId можно передать через query параметр или через авторизацию
 */
router.get("/google", (req, res) => {
  try {
    // Пробуем получить userId из query параметра или из авторизации
    let userId: string | undefined;
    
    if (req.query.userId && typeof req.query.userId === "string") {
      userId = req.query.userId;
    } else if (req.user?.uid) {
      userId = req.user.uid;
    }
    
    if (!userId) {
      return res.status(400).json({
        error: "Missing userId",
        message: "userId is required. Pass it as query parameter: ?userId=YOUR_USER_ID",
        instructions: [
          "1. Получите ваш Firebase User ID",
          "2. Откройте: http://localhost:8080/api/auth/google?userId=YOUR_USER_ID",
          "3. Или авторизуйтесь через API с токеном в заголовке Authorization: Bearer YOUR_TOKEN"
        ]
      });
    }
    
    const oauth2Client = getOAuth2Client();
    
    // Сохраняем userId в state для получения в callback
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // Получаем refresh token
      scope: SCOPES,
      prompt: "consent", // Принудительно показываем consent screen для получения refresh token
      state: state // Передаём userId через state
    });

    Logger.info("Google OAuth authorization URL generated", { userId });
    res.redirect(authUrl);
  } catch (error) {
    Logger.error("Failed to generate Google OAuth URL", error);
    res.status(500).json({
      error: "Failed to initialize Google OAuth",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/auth/google/drive
 * Начинает OAuth flow для Google Drive
 * Требует сессию через cookie, получает userId из сессии
 * Делает redirect на Google OAuth URL
 */
router.get("/google/drive", requireSession, async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "https://shortsai.ru";
  
  try {
    // Проверяем, что пользователь авторизован через сессию
    if (!req.user?.uid) {
      Logger.warn("GET /api/auth/google/drive: User not authenticated", {
        requestId,
        method: req.method,
        path: req.path,
        hasUser: !!req.user,
        cookies: Object.keys(req.cookies || {})
      });
      return res.status(401).json({
        error: "Unauthorized",
        message: "Session cookie is missing or invalid. Please login first."
      });
    }

    const userId = req.user.uid;
    const returnTo = (req.query.returnTo as string) || "/settings";
    
    Logger.info("GET /api/auth/google/drive: OAuth flow started", {
      requestId,
      userId,
      email: req.user.email || "not provided",
      returnTo,
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      userAgent: req.headers["user-agent"],
      origin: req.headers.origin || "none",
      hasSessionCookie: !!req.cookies?.session
    });
    
    // Проверяем наличие необходимых env переменных
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    // Формируем redirect_uri из env переменных
    const backendBaseUrl = process.env.BACKEND_BASE_URL || "https://shortsai-backend-905027425668.us-central1.run.app";
    const redirectPath = process.env.GOOGLE_REDIRECT_PATH || "/api/integrations/google-drive/callback";
    const redirectUri: string = process.env.GOOGLE_OAUTH_REDIRECT_URL || `${backendBaseUrl}${redirectPath}`;
    
    if (!clientId || !clientSecret) {
      Logger.error("GET /api/auth/google/drive: Missing env variables", {
        requestId,
        userId,
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret
      });
      
      const errorUrl = `${frontendOrigin}${returnTo}${returnTo.includes("?") ? "&" : "?"}drive=error&reason=oauth_config`;
      return res.redirect(errorUrl);
    }
    
    // Создаём OAuth2 клиент для Google Drive
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
    
    // Генерируем подписанный state с userId и returnTo
    const state = generateOAuthState({
      userId,
      returnTo,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString("hex")
    });
    
    // Scopes для Google Drive
    const scopes = [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive"
    ];
    
    // Генерируем URL для авторизации
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // Получаем refresh token
      prompt: "consent", // Принудительно показываем consent screen
      scope: scopes,
      state: state
    });
    
    Logger.info("GET /api/auth/google/drive: Google OAuth URL generated", {
      requestId,
      userId,
      returnTo,
      redirectUri,
      authUrlLength: authUrl.length,
      hasState: !!state
    });
    
    // Делаем redirect на Google OAuth
    return res.redirect(authUrl);
  } catch (error: any) {
    Logger.error("GET /api/auth/google/drive: Failed to start OAuth flow", {
      requestId,
      userId: req.user?.uid,
      error: error?.message || String(error),
      errorStack: error?.stack
    });
    
    const returnTo = (req.query.returnTo as string) || "/settings";
    const errorUrl = `${frontendOrigin}${returnTo}${returnTo.includes("?") ? "&" : "?"}drive=error&reason=oauth_start`;
    return res.redirect(errorUrl);
  }
});

/**
 * GET /api/auth/google/callback
 * Обрабатывает callback от Google OAuth
 * Сохраняет токены в Firestore для пользователя из state
 */
router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== "string") {
      return res.status(400).json({
        error: "Missing authorization code",
        message: "Authorization code is required"
      });
    }

    // Получаем userId из state
    let userId: string;
    if (state && typeof state === "string") {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        userId = stateData.userId;
      } catch {
        return res.status(400).json({
          error: "Invalid state parameter",
          message: "State parameter is invalid or corrupted"
        });
      }
    } else {
      return res.status(400).json({
        error: "Missing state parameter",
        message: "State parameter is required to identify user"
      });
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    Logger.info("Google OAuth tokens received", {
      userId,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expiry_date
    });

    // Сохраняем токены в Firestore
    try {
      await saveUserOAuthTokens(userId, {
        access_token: tokens.access_token ?? undefined,
        refresh_token: tokens.refresh_token ?? undefined,
        expiry_date: tokens.expiry_date ?? undefined
      });
      
      Logger.info("OAuth tokens saved to Firestore", { userId });
    } catch (saveError) {
      Logger.error("Failed to save OAuth tokens to Firestore", saveError);
      // Продолжаем, даже если не удалось сохранить
    }

    // Возвращаем успешный ответ
    res.json({
      success: true,
      message: "Authorization successful. Tokens saved.",
      tokens: {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
      },
      note: "Теперь вы можете загружать файлы в Google Drive через API"
    });
  } catch (error) {
    Logger.error("Failed to exchange authorization code for tokens", error);
    res.status(500).json({
      error: "Failed to complete OAuth flow",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/auth/google/refresh
 * Обновляет access token используя refresh token
 */
router.post("/google/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: "Missing refresh token",
        message: "refresh_token is required"
      });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token });

    const { credentials } = await oauth2Client.refreshAccessToken();

    Logger.info("Google OAuth access token refreshed");

    res.json({
      success: true,
      tokens: {
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date
      }
    });
  } catch (error) {
    Logger.error("Failed to refresh access token", error);
    res.status(500).json({
      error: "Failed to refresh access token",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

