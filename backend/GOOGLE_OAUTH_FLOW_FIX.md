# 🔧 Исправление Google OAuth Flow для продакшена

## Проблема

Google Drive OAuth работал локально, но в проде после клика "Подключить Google Drive" пользователь проходил Google OAuth и затем его перекидывало на главную страницу. В UI статус "Google Drive не привязан" (интеграция не завершалась/не отображалась).

## Решение

Реализован корректный OAuth flow с:
1. ✅ State с HMAC подписью (включая returnTo)
2. ✅ Валидация state на callback
3. ✅ Сохранение tokens в Firestore
4. ✅ Редирект на returnTo с параметром статуса
5. ✅ Подробные логи
6. ✅ Правильное формирование redirect_uri из ENV

## Изменённые файлы

### Backend

1. **`backend/src/utils/oauthState.ts`** (новый файл)
   - Генерация state с HMAC подписью
   - Валидация state с проверкой TTL (10 минут)

2. **`backend/src/services/GoogleDriveOAuthService.ts`**
   - Обновлён `generateAuthUrl()` для принятия `userId`, `returnTo`, `requestId`
   - State теперь включает `userId`, `returnTo`, `nonce`, `timestamp`
   - Обновлён `handleOAuthCallback()` для принятия `requestId`
   - `redirect_uri` формируется из `BACKEND_BASE_URL + GOOGLE_REDIRECT_PATH`

3. **`backend/src/routes/googleDriveIntegrationRoutes.ts`**
   - Обновлён `GET /api/google-drive-integration/oauth/url` для принятия `returnTo` query параметра
   - Добавлены подробные логи с `requestId`
   - `POST /api/google-drive-integration/oauth/callback` оставлен для обратной совместимости

4. **`backend/src/routes/googleDriveOAuthCallbackRoutes.ts`** (новый файл)
   - `GET /api/integrations/google-drive/callback` - новый endpoint для обработки callback от Google
   - Валидация state
   - Обработка ошибок от Google
   - Редирект на фронтенд с параметром статуса

5. **`backend/src/index.ts`**
   - Добавлен роутер `/api/integrations/google-drive`

### Frontend

1. **`src/api/googleDriveIntegration.ts`**
   - Обновлён `getGoogleDriveAuthUrl()` для принятия `returnTo` параметра

2. **`src/components/GoogleDriveIntegration.tsx`**
   - Передача `returnTo` при вызове `getGoogleDriveAuthUrl()`

3. **`src/components/wizard/WizardGoogleDriveStep.tsx`**
   - Передача `returnTo="/channels/new"` при вызове `getGoogleDriveAuthUrl()`

4. **`src/components/IntegrationsStatusBlock.tsx`**
   - Передача `returnTo` при вызове `getGoogleDriveAuthUrl()`

5. **`src/pages/ChannelEdit/ChannelEditPage.tsx`**
   - Передача `currentPath` как `returnTo` при вызове `getGoogleDriveAuthUrl()`

## Переменные окружения

### Требуемые переменные на Cloud Run

```bash
# Google OAuth
GOOGLE_CLIENT_ID=1071312089506-4dmiqpsrefmqomcar7pto8ct7fpb94p4.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# Backend URL (для формирования redirect_uri)
BACKEND_BASE_URL=https://shortsai-backend-905027425668.us-central1.run.app

# Путь для callback (опционально, по умолчанию /api/integrations/google-drive/callback)
GOOGLE_REDIRECT_PATH=/api/integrations/google-drive/callback

# Frontend URL (для редиректа после успешной авторизации)
FRONTEND_ORIGIN=https://shortsai.ru

# Секрет для подписи state (используется JWT_SECRET если не указан)
OAUTH_STATE_SECRET=your-secret-here  # Опционально, по умолчанию используется JWT_SECRET
```

### Команды для установки переменных на Cloud Run

```powershell
# Установка BACKEND_BASE_URL
gcloud run services update shortsai-backend --region us-central1 --update-env-vars "BACKEND_BASE_URL=https://shortsai-backend-905027425668.us-central1.run.app"

# Установка GOOGLE_REDIRECT_PATH (опционально, если нужно изменить путь)
gcloud run services update shortsai-backend --region us-central1 --update-env-vars "GOOGLE_REDIRECT_PATH=/api/integrations/google-drive/callback"

# Установка FRONTEND_ORIGIN (если ещё не установлен)
gcloud run services update shortsai-backend --region us-central1 --update-env-vars "FRONTEND_ORIGIN=https://shortsai.ru"

# Установка OAUTH_STATE_SECRET (опционально, если хотите отдельный секрет)
# Сначала создайте secret в Secret Manager:
echo -n "your-oauth-state-secret-here" | gcloud secrets create oauth-state-secret --data-file=-
gcloud secrets add-iam-policy-binding oauth-state-secret --member="serviceAccount:905027425668-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
# Затем используйте его:
gcloud run services update shortsai-backend --region us-central1 --update-secrets OAUTH_STATE_SECRET=oauth-state-secret:latest
```

### Формирование redirect_uri

`redirect_uri` формируется автоматически из:
```
redirect_uri = BACKEND_BASE_URL + GOOGLE_REDIRECT_PATH
```

Пример:
```
redirect_uri = https://shortsai-backend-905027425668.us-central1.run.app/api/integrations/google-drive/callback
```

## Настройка Google Cloud Console OAuth Client

### 1. Откройте Google Cloud Console

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Выберите проект
3. Перейдите в **APIs & Services** → **Credentials**
4. Найдите ваш OAuth 2.0 Client ID (или создайте новый)

### 2. Настройте Authorized JavaScript origins

Добавьте:
```
https://shortsai.ru
https://shortsai-backend-905027425668.us-central1.run.app
```

### 3. Настройте Authorized redirect URIs

**ВАЖНО**: Удалите старый redirect URI (`https://shortsai.ru/google-drive/callback`) и добавьте новый:

```
https://shortsai-backend-905027425668.us-central1.run.app/api/integrations/google-drive/callback
```

### 4. Сохраните изменения

Нажмите **Save** внизу страницы.

## Проверка работы

### 1. Проверка в браузере (Network tab)

1. Откройте DevTools (F12) → вкладка **Network**
2. Откройте страницу настроек: `https://shortsai.ru/settings`
3. Нажмите "Подключить Google Drive"
4. Проверьте запросы:

   **Запрос 1: GET /api/google-drive-integration/oauth/url**
   - Status: 200
   - Response должен содержать `authUrl` с параметром `state=...`
   - URL должен содержать `redirect_uri=https://shortsai-backend-905027425668.us-central1.run.app/api/integrations/google-drive/callback`

   **Запрос 2: GET /api/integrations/google-drive/callback?code=...&state=...**
   - Status: 302 (Redirect)
   - Location header должен быть: `https://shortsai.ru/settings?drive=connected`

### 2. Проверка логов Cloud Run

```powershell
# Просмотр последних логов
gcloud run services logs read shortsai-backend --region us-central1 --limit 50

# Фильтрация логов по OAuth
gcloud run services logs read shortsai-backend --region us-central1 --limit 100 | Select-String "oauth|OAuth|callback"
```

### 3. Проверка статуса интеграции

1. После успешной авторизации откройте: `https://shortsai.ru/settings?drive=connected`
2. Статус должен показывать "Google Drive подключен" с email
3. Проверьте в Network tab запрос `GET /api/google-drive-integration/status`:
   - Response: `{ "connected": true, "email": "user@example.com" }`

### 4. Проверка редиректа на returnTo

1. Откройте страницу редактирования канала: `https://shortsai.ru/channels/{channelId}/edit`
2. Нажмите "Подключить Google Drive"
3. После авторизации вы должны вернуться на ту же страницу: `https://shortsai.ru/channels/{channelId}/edit?drive=connected`

## Troubleshooting

### Проблема: "Invalid state signature"

**Причина**: `OAUTH_STATE_SECRET` не совпадает или не установлен.

**Решение**:
1. Убедитесь, что `OAUTH_STATE_SECRET` установлен (или используется `JWT_SECRET`)
2. Проверьте, что секрет одинаковый на всех инстансах

### Проблема: "State expired"

**Причина**: State истёк (TTL 10 минут).

**Решение**: Попробуйте подключить Google Drive снова.

### Проблема: "redirect_uri_mismatch"

**Причина**: Redirect URI в Google Cloud Console не совпадает с тем, что используется в коде.

**Решение**:
1. Проверьте `BACKEND_BASE_URL` и `GOOGLE_REDIRECT_PATH` в Cloud Run
2. Убедитесь, что в Google Cloud Console добавлен правильный redirect URI:
   ```
   https://shortsai-backend-905027425668.us-central1.run.app/api/integrations/google-drive/callback
   ```

### Проблема: Редирект на главную страницу вместо returnTo

**Причина**: `returnTo` не передаётся или не сохраняется в state.

**Решение**:
1. Проверьте, что фронтенд передаёт `returnTo` при вызове `getGoogleDriveAuthUrl(returnTo)`
2. Проверьте логи: должен быть `returnTo` в логах `generateAuthUrl`

### Проблема: Интеграция не сохраняется

**Причина**: Ошибка при сохранении в Firestore или отсутствие refresh_token.

**Решение**:
1. Проверьте логи Cloud Run на наличие ошибок
2. Убедитесь, что пользователь дал согласие на `offline` доступ (параметр `access_type: "offline"`)

## Архитектура OAuth Flow

```
1. Пользователь нажимает "Подключить Google Drive"
   ↓
2. Frontend: GET /api/google-drive-integration/oauth/url?returnTo=/settings
   ↓
3. Backend: Генерирует state (HMAC) с userId, returnTo, nonce, timestamp
   ↓
4. Backend: Возвращает authUrl с state
   ↓
5. Frontend: Редиректит на Google OAuth (authUrl)
   ↓
6. Пользователь авторизуется в Google
   ↓
7. Google: Редиректит на BACKEND_BASE_URL + GOOGLE_REDIRECT_PATH?code=...&state=...
   ↓
8. Backend: GET /api/integrations/google-drive/callback
   - Валидирует state (HMAC, TTL)
   - Обменивает code на tokens
   - Сохраняет tokens в Firestore
   - Редиректит на FRONTEND_ORIGIN + returnTo + ?drive=connected
   ↓
9. Frontend: Показывает статус "Google Drive подключен"
```

## Безопасность

1. **State с HMAC**: Предотвращает CSRF атаки
2. **TTL проверка**: State действителен только 10 минут
3. **Nonce**: Уникальный идентификатор для каждого запроса
4. **Валидация userId**: State содержит userId, который проверяется на callback

## Дополнительные улучшения

- ✅ Подробные логи с `requestId` для трейсинга
- ✅ Обработка всех типов ошибок от Google
- ✅ Редирект на returnTo с параметром статуса
- ✅ Обратная совместимость с POST callback endpoint




