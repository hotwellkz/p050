# 🔧 Исправление ошибки `invalid_grant` в Google OAuth

## Проблема

При попытке загрузить видео в Google Drive возникает ошибка:
```
invalid_grant
```

Эта ошибка означает, что **refresh token** больше недействителен.

## Причины ошибки `invalid_grant`

1. **Пользователь отозвал доступ** в настройках Google аккаунта
2. **OAuth клиент был изменён или удалён** в Google Cloud Console
3. **Пользователь изменил пароль** Google аккаунта
4. **Refresh token был выдан для другого OAuth клиента**
5. **Refresh token истёк** (редко, но возможно)

## Решение

### Для пользователя

**Переподключите Google Drive:**

1. Откройте **Настройки** → **Интеграции**
2. Найдите **Google Drive**
3. Нажмите **"Отключить"** (если подключено)
4. Нажмите **"Подключить Google Drive"**
5. Разрешите доступ в окне Google OAuth
6. Попробуйте снова загрузить видео

### Для разработчика

#### 1. Проверьте логи Cloud Run

```powershell
gcloud run services logs read shortsai-backend --region us-central1 --limit 100 --format json | ConvertFrom-Json | Where-Object { $_.textPayload -like "*invalid_grant*" -or $_.textPayload -like "*refresh token*" } | Select-Object -First 10
```

#### 2. Проверьте статус интеграции в Firestore

Интеграция должна быть помечена как `status: "error"` с сообщением:
```
Refresh token is invalid or expired. Please reconnect Google Drive.
```

#### 3. Проверьте OAuth клиент в Google Cloud Console

1. Откройте [Google Cloud Console](https://console.cloud.google.com/)
2. Перейдите в **APIs & Services** → **Credentials**
3. Найдите OAuth 2.0 Client ID, используемый для Google Drive
4. Убедитесь, что:
   - Клиент активен
   - **Authorized redirect URIs** содержит правильный URL:
     - `https://shortsai.ru/api/integrations/google-drive/callback`
     - `http://localhost:8080/api/integrations/google-drive/callback` (для разработки)

#### 4. Проверьте переменные окружения на Cloud Run

```powershell
gcloud run services describe shortsai-backend --region us-central1 --format="value(spec.template.spec.containers[0].env)"
```

Убедитесь, что установлены:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URL`

## Технические детали

### Как работает обновление токенов

1. При истечении `access_token` система пытается обновить его через `refresh_token`
2. Если `refresh_token` недействителен, Google возвращает ошибку `invalid_grant`
3. Система помечает интеграцию как `status: "error"`
4. Пользователь получает сообщение: `GOOGLE_DRIVE_REAUTH_REQUIRED`

### Код обработки ошибки

**Файл:** `backend/src/services/GoogleDriveOAuthService.ts`

```typescript
if (
  errorMessage.includes("invalid_grant") ||
  errorCode === "invalid_grant" ||
  errorResponse?.error === "invalid_grant"
) {
  await updateGoogleDriveIntegration(integration.id, {
    status: "error",
    lastError: "Refresh token is invalid or expired. Please reconnect Google Drive."
  });

  throw new Error(
    "GOOGLE_DRIVE_REAUTH_REQUIRED: Токен доступа Google Drive недействителен. Пожалуйста, переподключите Google Drive в настройках."
  );
}
```

## Профилактика

### Для пользователей

- Не отзывайте доступ к приложению в Google аккаунте
- Не меняйте пароль Google без необходимости
- Если меняете пароль, переподключите Google Drive

### Для разработчиков

1. **Мониторинг ошибок:**
   - Настройте алерты на ошибки `invalid_grant` в Cloud Run
   - Отслеживайте количество интеграций со статусом `error`

2. **Автоматическое уведомление:**
   - При ошибке `invalid_grant` отправляйте уведомление пользователю
   - Предлагайте переподключить Google Drive прямо из уведомления

3. **Проверка токенов:**
   - Периодически проверяйте валидность refresh tokens
   - Автоматически помечайте недействительные интеграции

## Проверка после исправления

1. **Пользователь переподключает Google Drive**
2. **Проверьте логи:**
   ```powershell
   gcloud run services logs read shortsai-backend --region us-central1 --limit 50 | Select-String "Google Drive"
   ```
3. **Попробуйте загрузить видео** - должно работать

## Связанные файлы

- `backend/src/services/GoogleDriveOAuthService.ts` - обработка OAuth токенов
- `backend/src/services/googleDriveUserUploadService.ts` - загрузка файлов
- `backend/src/routes/googleDriveIntegrationRoutes.ts` - API endpoints

## Дополнительная информация

- [Google OAuth 2.0 Error Codes](https://developers.google.com/identity/protocols/oauth2/web-server#error-codes)
- [Refresh Token Best Practices](https://developers.google.com/identity/protocols/oauth2/web-server#offline)


