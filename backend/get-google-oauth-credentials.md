# 🔑 Получение Google OAuth credentials

## Быстрая инструкция

### Шаг 1: Откройте Google Cloud Console

1. Перейдите на https://console.cloud.google.com/
2. Выберите проект `prompt-6a4fd`

### Шаг 2: Настройте OAuth consent screen (если еще не настроен)

1. Перейдите в **APIs & Services** → **OAuth consent screen**
2. Выберите **External** (для тестирования)
3. Заполните обязательные поля:
   - **App name**: ShortsAI
   - **User support email**: ваш email
   - **Developer contact information**: ваш email
4. Нажмите **Save and Continue**
5. На шаге **Scopes** нажмите **Save and Continue** (scopes уже настроены)
6. На шаге **Test users** добавьте свой email и нажмите **Save and Continue**
7. Нажмите **Back to Dashboard**

### Шаг 3: Создайте OAuth 2.0 Client ID

1. Перейдите в **APIs & Services** → **Credentials**
2. Нажмите **Create Credentials** → **OAuth client ID**
3. Выберите **Web application**
4. Введите **Name**: `ShortsAI Web Client`
5. Добавьте **Authorized redirect URIs**:
   ```
   https://shortsai.ru/google-drive/callback
   http://localhost:5173/google-drive/callback
   ```
6. Нажмите **Create**
7. Скопируйте **Client ID** и **Client Secret**

### Шаг 4: Установите на Cloud Run

После получения credentials выполните:

```powershell
gcloud run services update shortsai-backend --region us-central1 `
  --update-env-vars "GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com,GOOGLE_CLIENT_SECRET=your-client-secret"
```

Замените `your-client-id` и `your-client-secret` на реальные значения.

## Альтернатива: Использовать только Service Account

Если не нужна персональная интеграция пользователей, можно использовать только Service Account:

1. Убедитесь, что установлены:
   - `GOOGLE_DRIVE_CLIENT_EMAIL`
   - `GOOGLE_DRIVE_PRIVATE_KEY`
   - `GOOGLE_DRIVE_DEFAULT_PARENT`

2. Система автоматически переключится на Service Account, если OAuth не настроен

## Текущий статус

- ✅ `GOOGLE_OAUTH_REDIRECT_URL` - установлен
- ⚠️ `GOOGLE_CLIENT_ID` - установлены временные значения (нужны реальные)
- ⚠️ `GOOGLE_CLIENT_SECRET` - установлены временные значения (нужны реальные)




