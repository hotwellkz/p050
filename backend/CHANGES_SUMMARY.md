# 📋 Сводка изменений: Cookie-based Session для OAuth

## Изменённые файлы

### Backend

1. **`backend/src/middleware/session.ts`** (новый файл)
   - Middleware `requireSession` для проверки cookie
   - Функции `createSessionToken`, `setSessionCookie`, `clearSessionCookie`

2. **`backend/src/routes/authRoutes.ts`**
   - Добавлен endpoint `POST /api/auth/session`
   - Добавлен endpoint `POST /api/auth/session/logout`
   - `/api/auth/google/drive` теперь использует `requireSession` вместо `authRequired`
   - Добавлен импорт `crypto` для генерации nonce

3. **`backend/src/index.ts`**
   - Добавлен `cookie-parser` middleware
   - Обновлён CORS для работы с cookies (`credentials: true`)
   - CORS возвращает точный origin вместо `true`

4. **`backend/package.json`**
   - Добавлена зависимость `cookie-parser`
   - Добавлена зависимость `@types/cookie-parser`

### Frontend

1. **`src/api/session.ts`** (новый файл)
   - `createSession()` - создаёт сессию на бэкенде
   - `clearSession()` - очищает сессию

2. **`src/stores/authStore.ts`**
   - `setFromFirebaseUser` автоматически создаёт/очищает сессию

3. **`src/components/GoogleDriveIntegration.tsx`**
   - Комментарий о cookie сессии

4. **`src/components/IntegrationsStatusBlock.tsx`**
   - Комментарий о cookie сессии

5. **`src/components/wizard/WizardGoogleDriveStep.tsx`**
   - Комментарий о cookie сессии

6. **`src/pages/ChannelEdit/ChannelEditPage.tsx`**
   - Комментарий о cookie сессии

7. **`src/utils/apiFetch.ts`** (новый файл)
   - Утилита для fetch с `credentials: 'include'`

## Переменные окружения для Cloud Run

### Обязательные новые переменные:

```bash
COOKIE_SECRET=<random-secret-min-32-chars>  # Секрет для JWT подписи session cookie
```

### Существующие переменные (убедитесь, что установлены):

```bash
FRONTEND_ORIGIN=https://shortsai.ru
BACKEND_BASE_URL=https://shortsai-backend-905027425668.us-central1.run.app
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_OAUTH_REDIRECT_URI=https://shortsai-backend-905027425668.us-central1.run.app/api/integrations/google-drive/callback
GOOGLE_REDIRECT_PATH=/api/integrations/google-drive/callback
FIREBASE_SERVICE_ACCOUNT=<json-string>
TELEGRAM_API_ID=<id>
TELEGRAM_API_HASH=<hash>
TELEGRAM_SESSION_SECRET=<secret>
SYNX_CHAT_ID=@syntxaibot
```

## Команды для установки на Cloud Run

```powershell
# 1. Генерация COOKIE_SECRET
$cookieSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "Generated COOKIE_SECRET: $cookieSecret"

# 2. Установка через env var (простой способ)
gcloud run services update shortsai-backend --region us-central1 --update-env-vars "COOKIE_SECRET=$cookieSecret"

# 3. Или через Secret Manager (рекомендуется для production)
echo $cookieSecret | gcloud secrets create cookie-secret --data-file=-
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

## Как работает OAuth Flow

1. **Логин пользователя:**
   - Пользователь логинится через Firebase Auth
   - Frontend автоматически вызывает `POST /api/auth/session` с Firebase ID token
   - Backend валидирует токен, создаёт JWT session token, устанавливает httpOnly cookie

2. **Подключение Google Drive:**
   - Пользователь нажимает "Подключить Google Drive"
   - Frontend делает `window.location.href = /api/auth/google/drive?returnTo=/settings`
   - Браузер автоматически отправляет cookie с запросом
   - Backend проверяет cookie через `requireSession`, получает `userId`
   - Backend генерирует Google OAuth URL с state, делает `res.redirect()`

3. **Callback от Google:**
   - Google редиректит на `/api/integrations/google-drive/callback?code=...&state=...`
   - Backend валидирует state, обменивает code на tokens
   - Backend сохраняет tokens в Firestore, редиректит на frontend с `?drive=connected`

## Проверка работы

### 1. Проверка создания сессии:
```powershell
# Логи после логина
gcloud run services logs read shortsai-backend --region us-central1 --limit 50 | Select-String "POST /api/auth/session"
```

### 2. Проверка OAuth flow:
```powershell
# Логи старта OAuth
gcloud run services logs read shortsai-backend --region us-central1 --limit 50 | Select-String "OAuth flow started"

# Логи callback
gcloud run services logs read shortsai-backend --region us-central1 --limit 50 | Select-String "callback: Request received"
```

### 3. Проверка в браузере:
1. Откройте DevTools → Application → Cookies
2. После логина должна появиться cookie `session` для домена backend
3. При клике "Подключить Google Drive" cookie должна отправляться автоматически

## Важные моменты

1. **Cookie настройки:**
   - `httpOnly: true` - защита от XSS
   - `secure: true` в production - только HTTPS
   - `sameSite: "none"` в production - для cross-origin
   - Domain не устанавливается для cross-origin cookies (frontend и backend на разных доменах)

2. **CORS:**
   - `credentials: true` обязательно
   - Origin должен быть точным (не `*`)
   - Backend возвращает точный origin в `Access-Control-Allow-Origin`

3. **Безопасность:**
   - `COOKIE_SECRET` должен быть длинным случайным строкой (минимум 32 символа)
   - Используйте Secret Manager для хранения секретов
   - Cookie автоматически истекает через 7 дней
   - JWT токен подписан HMAC для защиты от подделки


