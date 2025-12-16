# ✅ Исправление OAuth Flow для Google Drive

## Проблема

При клике «Подключить Google Drive» пользователь сразу редиректился на главную страницу, Google OAuth экран не появлялся.

**Причина:** OAuth запускался через `fetch()` вместо browser redirect.

## Решение

### 1. Backend: Новый endpoint `/api/auth/google/drive`

**Файл:** `backend/src/routes/authRoutes.ts`

```typescript
/**
 * GET /api/auth/google/drive?returnTo=/settings
 * Начинает OAuth flow для Google Drive
 * Требует авторизацию, получает userId из токена
 * Делает redirect на Google OAuth URL
 */
router.get("/google/drive", authRequired, async (req, res) => {
  // Генерирует state с userId и returnTo
  // Делает res.redirect() на Google OAuth URL
});
```

**Особенности:**
- ✅ Требует авторизацию (`authRequired`)
- ✅ Получает `userId` из токена
- ✅ Принимает `returnTo` из query параметра
- ✅ Генерирует подписанный `state` с HMAC
- ✅ Делает `res.redirect()` на Google OAuth URL
- ✅ Логирует все действия

### 2. Backend: Callback endpoint

**Файл:** `backend/src/routes/googleDriveOAuthCallbackRoutes.ts`

**Изменения:**
- ✅ Валидирует `state` с HMAC
- ✅ Сохраняет токены в Firestore
- ✅ **НЕ возвращает JSON**
- ✅ Делает `res.redirect()` на фронтенд:
  - Успех: `https://shortsai.ru/settings?drive=connected`
  - Ошибка: `https://shortsai.ru/settings?drive=error&reason=oauth`

### 3. Frontend: Убраны все `fetch()` для OAuth

**Изменённые файлы:**

#### `src/components/GoogleDriveIntegration.tsx`
```typescript
// БЫЛО:
const { url } = await getGoogleDriveAuthUrl();
window.location.href = url;

// СТАЛО:
const backendUrl = import.meta.env.VITE_API_BASE_URL || "...";
window.location.href = `${backendUrl}/api/auth/google/drive?returnTo=${encodeURIComponent(returnTo)}`;
```

#### `src/components/IntegrationsStatusBlock.tsx`
- Убран `fetch()` к `getGoogleDriveAuthUrl()`
- Прямой redirect на `/api/auth/google/drive`

#### `src/components/wizard/WizardGoogleDriveStep.tsx`
- Убран `fetch()` к `getGoogleDriveAuthUrl()`
- Прямой redirect на `/api/auth/google/drive?returnTo=/channels/new`

#### `src/pages/ChannelEdit/ChannelEditPage.tsx`
- Убран `fetch()` к `getGoogleDriveAuthUrl()`
- Прямой redirect на `/api/auth/google/drive?returnTo=...`

### 4. Логирование

**Добавлено логирование:**

1. **Старт OAuth:**
   ```typescript
   Logger.info("GET /api/auth/google/drive: OAuth flow started", {
     requestId,
     userId,
     returnTo,
     redirectUri
   });
   ```

2. **Генерация URL:**
   ```typescript
   Logger.info("GET /api/auth/google/drive: Google OAuth URL generated", {
     requestId,
     userId,
     returnTo,
     redirectUri,
     authUrlLength: authUrl.length
   });
   ```

3. **Callback получен:**
   ```typescript
   Logger.info("GET /api/integrations/google-drive/callback: Request received", {
     requestId,
     hasCode: !!code,
     hasState: !!state
   });
   ```

4. **Успешный callback:**
   ```typescript
   Logger.info("GET /api/integrations/google-drive/callback: Integration connected successfully", {
     requestId,
     userId,
     email: result.email,
     returnTo
   });
   ```

5. **Финальный redirect:**
   ```typescript
   Logger.info("GET /api/integrations/google-drive/callback: Redirecting to frontend (success)", {
     requestId,
     userId,
     redirectUrl,
     finalDestination: successReturnTo
   });
   ```

## Изменённые файлы

### Backend:
1. `backend/src/routes/authRoutes.ts` - добавлен endpoint `/api/auth/google/drive`
2. `backend/src/routes/googleDriveOAuthCallbackRoutes.ts` - улучшено логирование
3. `backend/src/services/GoogleDriveOAuthService.ts` - добавлен параметр `requestId`
4. `backend/src/index.ts` - зарегистрирован `googleDriveOAuthCallbackRoutes`

### Frontend:
1. `src/components/GoogleDriveIntegration.tsx` - убран `fetch()`, прямой redirect
2. `src/components/IntegrationsStatusBlock.tsx` - убран `fetch()`, прямой redirect
3. `src/components/wizard/WizardGoogleDriveStep.tsx` - убран `fetch()`, прямой redirect
4. `src/pages/ChannelEdit/ChannelEditPage.tsx` - убран `fetch()`, прямой redirect

## Чек-лист для Google Cloud Console

### Authorized JavaScript origins:
```
https://shortsai.ru
https://shortsai-backend-905027425668.us-central1.run.app
```

### Authorized redirect URIs:
```
https://shortsai-backend-905027425668.us-central1.run.app/api/integrations/google-drive/callback
```

**Или если используется `GOOGLE_REDIRECT_PATH`:**
```
${BACKEND_BASE_URL}${GOOGLE_REDIRECT_PATH}
```

## Переменные окружения для production

### Backend (Cloud Run):

```bash
# Google OAuth для Google Drive
GOOGLE_CLIENT_ID=1071312089506-4dmiqpsrefmqomcar7pto8ct7fpb94p4.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# Redirect URI (опционально, формируется автоматически)
GOOGLE_OAUTH_REDIRECT_URL=https://shortsai-backend-905027425668.us-central1.run.app/api/integrations/google-drive/callback

# Или используйте отдельные переменные:
BACKEND_BASE_URL=https://shortsai-backend-905027425668.us-central1.run.app
GOOGLE_REDIRECT_PATH=/api/integrations/google-drive/callback

# Frontend origin
FRONTEND_ORIGIN=https://shortsai.ru

# Secret для подписи state (опционально)
OAUTH_STATE_SECRET=<ваш-секрет>
```

### Frontend (Netlify):

```bash
VITE_API_BASE_URL=https://shortsai-backend-905027425668.us-central1.run.app
```

## Проверка работы

1. **Откройте https://shortsai.ru/settings**
2. **Нажмите "Подключить Google Drive"**
3. **Должен произойти redirect на Google OAuth экран**
4. **После авторизации redirect на `/settings?drive=connected`**

## Логи для диагностики

```powershell
# Проверка старта OAuth
gcloud run services logs read shortsai-backend --region us-central1 --limit 50 | Select-String "OAuth flow started"

# Проверка callback
gcloud run services logs read shortsai-backend --region us-central1 --limit 50 | Select-String "callback: Request received"

# Проверка успешного подключения
gcloud run services logs read shortsai-backend --region us-central1 --limit 50 | Select-String "Integration connected successfully"
```

## Важные моменты

✅ **OAuth запускается через browser redirect** (`window.location.href`)  
✅ **Backend делает `res.redirect()` на Google OAuth URL**  
✅ **Callback делает `res.redirect()` на фронтенд**  
✅ **Нет авто-редиректов на `/` при ошибках**  
✅ **Все действия логируются с `requestId`**  
❌ **НЕ используется `fetch()` для старта OAuth**  
❌ **НЕ возвращается JSON из callback**


