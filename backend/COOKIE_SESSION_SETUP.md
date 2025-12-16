# ✅ Настройка Cookie-based Session для OAuth Flow

## Изменения

### Backend

1. **Новый middleware `requireSession`** (`backend/src/middleware/session.ts`)
   - Проверяет session cookie вместо Authorization header
   - Верифицирует JWT токен из cookie
   - Устанавливает `req.user` при успешной проверке

2. **Endpoint POST `/api/auth/session`** (`backend/src/routes/authRoutes.ts`)
   - Принимает Firebase ID token
   - Валидирует через Firebase Admin
   - Создаёт JWT session token
   - Устанавливает httpOnly cookie

3. **Обновлён CORS** (`backend/src/index.ts`)
   - `credentials: true` для работы cookies
   - Возвращает точный origin для правильной работы cookies

4. **OAuth endpoints обновлены**
   - `/api/auth/google/drive` теперь использует `requireSession` вместо `authRequired`
   - Проверяет сессию через cookie

### Frontend

1. **Новый API модуль** (`src/api/session.ts`)
   - `createSession()` - создаёт сессию на бэкенде
   - `clearSession()` - очищает сессию

2. **Обновлён authStore** (`src/stores/authStore.ts`)
   - Автоматически создаёт сессию после логина
   - Очищает сессию при logout

3. **Компоненты Google Drive**
   - Используют прямой `window.location.href` для OAuth
   - Cookie отправляется автоматически браузером

## Переменные окружения для Cloud Run

```bash
# Обязательные
COOKIE_SECRET=<random-secret-32-chars-minimum>  # Секрет для JWT подписи
SESSION_COOKIE_NAME=session  # Имя cookie (опционально, по умолчанию "session")

# Существующие переменные
FRONTEND_ORIGIN=https://shortsai.ru
BACKEND_BASE_URL=https://shortsai-backend-905027425668.us-central1.run.app
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_OAUTH_REDIRECT_URI=https://shortsai-backend-905027425668.us-central1.run.app/api/integrations/google-drive/callback
GOOGLE_REDIRECT_PATH=/api/integrations/google-drive/callback

# Firebase
FIREBASE_SERVICE_ACCOUNT=<json-string>  # или отдельные переменные

# Telegram
TELEGRAM_API_ID=<id>
TELEGRAM_API_HASH=<hash>
TELEGRAM_SESSION_SECRET=<secret>
SYNX_CHAT_ID=@syntxaibot
```

## Команды для установки на Cloud Run

```powershell
# Установка COOKIE_SECRET (сгенерируйте случайный секрет)
$cookieSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
gcloud run services update shortsai-backend --region us-central1 --update-env-vars "COOKIE_SECRET=$cookieSecret"

# Или используйте Secret Manager (рекомендуется)
gcloud secrets create cookie-secret --data-file=- <<< "your-secret-here"
gcloud secrets add-iam-policy-binding cookie-secret --member="serviceAccount:905027425668-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud run services update shortsai-backend --region us-central1 --update-secrets "COOKIE_SECRET=cookie-secret:latest"
```

## Google Cloud Console OAuth Client

### Authorized JavaScript origins:
```
https://shortsai.ru
https://shortsai-backend-905027425668.us-central1.run.app
```

### Authorized redirect URIs:
```
https://shortsai-backend-905027425668.us-central1.run.app/api/integrations/google-drive/callback
```

## Проверка работы

1. **Логин:**
   - Пользователь логинится через Firebase
   - Frontend автоматически вызывает `POST /api/auth/session`
   - Backend устанавливает cookie

2. **OAuth Flow:**
   - Пользователь нажимает "Подключить Google Drive"
   - `window.location.href = /api/auth/google/drive?returnTo=/settings`
   - Backend проверяет cookie, генерирует OAuth URL, делает redirect
   - Google редиректит на callback
   - Backend сохраняет токены, редиректит на frontend

3. **Проверка логов:**
```powershell
# Логи создания сессии
gcloud run services logs read shortsai-backend --region us-central1 --limit 50 | Select-String "POST /api/auth/session"

# Логи OAuth flow
gcloud run services logs read shortsai-backend --region us-central1 --limit 50 | Select-String "OAuth flow started"

# Логи callback
gcloud run services logs read shortsai-backend --region us-central1 --limit 50 | Select-String "callback: Request received"
```

## Важные моменты

1. **Cookie настройки:**
   - `httpOnly: true` - защита от XSS
   - `secure: true` в production - только HTTPS
   - `sameSite: "none"` в production - для cross-origin
   - Domain не устанавливается для cross-origin cookies

2. **CORS:**
   - `credentials: true` обязательно
   - Origin должен быть точным (не `*`)

3. **Безопасность:**
   - `COOKIE_SECRET` должен быть длинным случайным строкой
   - Используйте Secret Manager для хранения секретов
   - Cookie автоматически истекает через 7 дней


