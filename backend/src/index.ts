import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import cron from "node-cron";
// Инициализация Firebase Admin (должна быть до импорта роутов, которые используют Firestore)
import "./services/firebaseAdmin";

// Подавляем TIMEOUT ошибки от Telegram библиотеки - они не критичны и забивают логи
const originalConsoleError = console.error;
console.error = function(...args: any[]) {
  const message = args[0]?.toString() || "";
  // Пропускаем TIMEOUT ошибки от telegram библиотеки
  if (message.includes("Error: TIMEOUT") && message.includes("telegram/client/updates")) {
    return; // Не выводим эти ошибки
  }
  originalConsoleError.apply(console, args);
};

// Импортируем Logger до использования
import { Logger } from "./utils/logger";
import { isFirebaseAuthAvailable, getFirebaseAuthInfo } from "./services/firebaseAdmin";

// Также обрабатываем unhandledRejection для TIMEOUT ошибок
process.on("unhandledRejection", (reason: any) => {
  if (reason?.message === "TIMEOUT" || reason?.message?.includes("TIMEOUT")) {
    // Подавляем TIMEOUT ошибки от Telegram - они не критичны
    return;
  }
  // Для остальных ошибок используем стандартную обработку
  Logger.error("Unhandled promise rejection", reason);
});
import telegramRoutes from "./routes/telegramRoutes";
import telegramIntegrationRoutes from "./routes/telegramIntegrationRoutes";
import cronRoutes from "./routes/cronRoutes";
import promptRoutes from "./routes/promptRoutes";
import googleDriveRoutes from "./routes/googleDriveRoutes";
import googleDriveIntegrationRoutes from "./routes/googleDriveIntegrationRoutes";
import googleDriveOAuthCallbackRoutes from "./routes/googleDriveOAuthCallbackRoutes";
import debugRoutes from "./routes/debugRoutes";
import testFirestoreRoutes from "./routes/testFirestoreRoutes";
import authRoutes from "./routes/authRoutes";
import channelRoutes from "./routes/channelRoutes";
import scheduleRoutes from "./routes/scheduleRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import adminRoutes from "./routes/adminRoutes";
import helpRoutes from "./routes/helpRoutes";
import userSettingsRoutes from "./routes/userSettingsRoutes";
import { processAutoSendTick } from "./services/autoSendScheduler";
import { getFirestoreInfo, isFirestoreAvailable } from "./services/firebaseAdmin";

const app = express();
// Cloud Run задаёт порт через переменную окружения PORT, по умолчанию 8080
const port = Number(process.env.PORT) || 8080;

// Нормализуем origin (убираем завершающий слеш)
const normalizeOrigin = (origin: string | undefined): string | undefined => {
  if (!origin) return undefined;
  return origin.replace(/\/+$/, "");
};

// Whitelist разрешённых origins
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];
  
  // Production origins
  origins.push("https://shortsai.ru");
  origins.push("https://www.shortsai.ru");
  
  // Dev origins (только в development)
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:5173");
    origins.push("http://localhost:3000");
  }
  
  // Дополнительный origin из env (если задан)
  const envOrigin = normalizeOrigin(process.env.FRONTEND_ORIGIN);
  if (envOrigin && !origins.includes(envOrigin)) {
    origins.push(envOrigin);
  }
  
  return origins;
};

const allowedOrigins = getAllowedOrigins();

// CORS конфигурация
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (например, Postman, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    const normalizedOrigin = normalizeOrigin(origin);
    
    if (!normalizedOrigin) {
      return callback(null, true);
    }
    
    // Проверяем whitelist
    if (allowedOrigins.includes(normalizedOrigin)) {
      // Возвращаем точный origin для правильной работы cookies
      return callback(null, normalizedOrigin);
    }
    
    // Логируем отклонённый origin для диагностики
    Logger.warn("CORS: origin not allowed", {
      origin: normalizedOrigin,
      allowedOrigins,
      method: "OPTIONS"
    });
    
    callback(new Error(`Origin ${normalizedOrigin} is not allowed by CORS`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "Accept",
    "X-Requested-With",
    "x-firebase-appcheck",
    "x-client-version"
  ],
  exposedHeaders: ["Content-Length", "Content-Type"],
  credentials: true, // КРИТИЧНО для работы cookies между доменами
  maxAge: 86400, // 24 часа
  optionsSuccessStatus: 204
};

// CORS middleware должен быть ПЕРВЫМ, до всех остальных middleware
app.use(cors(corsOptions));

// Явный обработчик OPTIONS для всех путей (preflight)
// Это гарантирует, что OPTIONS всегда отвечает 204 с правильными заголовками
app.options("*", cors(corsOptions));

// Cookie parser должен быть после CORS, но до других middleware
app.use(cookieParser());

// Увеличиваем лимит размера тела запроса для импорта каналов (до 10MB)
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public")); // Для статических файлов (HTML страница для OAuth)

app.use("/api/telegram", telegramRoutes);
app.use("/api/telegram-integration", telegramIntegrationRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/prompt", promptRoutes);
app.use("/api/google-drive", googleDriveRoutes);
app.use("/api/google-drive-integration", googleDriveIntegrationRoutes);
// OAuth callback route (GET) - должен быть до других маршрутов
const googleRedirectPath = process.env.GOOGLE_REDIRECT_PATH || "/api/integrations/google-drive/callback";
app.use(googleRedirectPath, googleDriveOAuthCallbackRoutes);
app.use("/api/debug", debugRoutes);
app.use("/internal/debug", debugRoutes); // Альтернативный путь для диагностики
app.use("/api/test", testFirestoreRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/help", helpRoutes);
app.use("/api/user-settings", userSettingsRoutes);

// Логируем подключенные маршруты для диагностики
Logger.info("Backend routes registered", {
  routes: [
    "/api/telegram",
    "/api/telegram-integration",
    "/api/cron",
    "/api/prompt",
    "/api/google-drive",
    "/api/google-drive-integration",
    "/api/debug",
    "/api/test",
    "/api/auth",
    "/api/channels",
    "/api/schedule",
    "/api/notifications"
  ]
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Health check для аутентификации / Firebase
app.get("/health/auth", (_req, res) => {
  const authInfo = getFirebaseAuthInfo();
  
  if (!authInfo.initialized) {
    return res.status(503).json({
      ok: false,
      code: "AUTH_UNAVAILABLE",
      message: authInfo.error || "Firebase Admin not initialized",
      reason: authInfo.errorDetails?.message || "Authentication service unavailable",
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    ok: true,
    code: "AUTH_OK",
    projectId: authInfo.projectId,
    credentialSource: authInfo.credentialSource,
    timestamp: new Date().toISOString()
  });
});

// Диагностический endpoint для проверки CORS
app.get("/api/cors-test", (req, res) => {
  const origin = req.headers.origin || "none";
  res.json({ 
    ok: true, 
    origin,
    allowedOrigins,
    timestamp: new Date().toISOString()
  });
});

// Слушаем на всех интерфейсах (0.0.0.0), как требует Cloud Run
app.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${port}`);
  
  // Логируем информацию о Firebase при старте
  const firestoreInfo = getFirestoreInfo();
  Logger.info("Backend startup: Firebase Admin status", {
    isFirestoreAvailable: isFirestoreAvailable(),
    firestoreInfo: firestoreInfo,
    env: {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "not set",
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? "set" : "not set",
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? "set" : "not set",
      FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT ? "set" : "not set"
    }
  });
});

// Запускаем планировщик автоотправки каждую минуту
// Это работает только если сервер запущен постоянно (например, на VM)
// Для Cloud Run используйте HTTP-эндпоинт /api/cron/manual-tick с Cloud Scheduler
if (process.env.ENABLE_CRON_SCHEDULER !== "false") {
  cron.schedule("* * * * *", async () => {
    Logger.info("Cron scheduler: running auto-send tick");
    try {
      await processAutoSendTick();
    } catch (error) {
      Logger.error("Cron scheduler: error in auto-send tick", error);
    }
  });
  Logger.info("Cron scheduler enabled: auto-send will run every minute");
} else {
  Logger.info("Cron scheduler disabled: use /api/cron/manual-tick with Cloud Scheduler");
}

// Запускаем мониторинг Blottata каждую минуту
if (process.env.ENABLE_CRON_SCHEDULER !== "false") {
  import("./services/blottataDriveMonitor").then(({ processBlottataTick }) => {
    cron.schedule("* * * * *", async () => {
      Logger.info("Cron scheduler: running Blottata monitoring tick");
      try {
        await processBlottataTick();
      } catch (error) {
        Logger.error("Cron scheduler: error in Blottata monitoring tick", error);
      }
    });
    Logger.info("Cron scheduler enabled: Blottata monitoring will run every minute");
  }).catch((error) => {
    Logger.error("Failed to load Blottata monitoring service", error);
  });
}


