# ⚠️ Настройка Google OAuth для Google Drive

## Проблема

Ошибка: "Google OAuth credentials not configured"

Это означает, что не установлены переменные окружения для Google OAuth 2.0.

## Необходимые переменные

Для работы Google Drive OAuth нужны три переменные:

1. **GOOGLE_CLIENT_ID** - Client ID из Google Cloud Console
2. **GOOGLE_CLIENT_SECRET** - Client Secret из Google Cloud Console  
3. **GOOGLE_OAUTH_REDIRECT_URL** - URL для callback (уже установлен: `https://shortsai.ru/google-drive/callback`)

## Как получить Google OAuth credentials

### Шаг 1: Создайте OAuth 2.0 Client ID в Google Cloud Console

1. Откройте https://console.cloud.google.com/
2. Выберите проект `prompt-6a4fd`
3. Перейдите в **APIs & Services** → **Credentials**
4. Нажмите **Create Credentials** → **OAuth client ID**
5. Выберите **Web application**
6. Добавьте **Authorized redirect URIs**:
   - `https://shortsai.ru/google-drive/callback`
   - `http://localhost:5173/google-drive/callback` (для разработки)
7. Нажмите **Create**
8. Скопируйте **Client ID** и **Client Secret**

### Шаг 2: Установите переменные на Cloud Run

```powershell
gcloud run services update shortsai-backend --region us-central1 `
  --update-env-vars "GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com,GOOGLE_CLIENT_SECRET=your-client-secret"
```

Или через Secret Manager (рекомендуется для продакшена):

```powershell
# Создайте секреты
echo -n "your-client-id.apps.googleusercontent.com" | gcloud secrets create google-client-id --data-file=-
echo -n "your-client-secret" | gcloud secrets create google-client-secret --data-file=-

# Дайте доступ Cloud Run
gcloud secrets add-iam-policy-binding google-client-id `
  --member="serviceAccount:905027425668-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding google-client-secret `
  --member="serviceAccount:905027425668-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

# Подключите к Cloud Run
gcloud run services update shortsai-backend --region us-central1 `
  --update-secrets "GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest"
```

## Текущий статус

- ✅ `GOOGLE_OAUTH_REDIRECT_URL` - установлен (`https://shortsai.ru/google-drive/callback`)
- ❌ `GOOGLE_CLIENT_ID` - **НЕ установлен** (нужно получить из Google Cloud Console)
- ❌ `GOOGLE_CLIENT_SECRET` - **НЕ установлен** (нужно получить из Google Cloud Console)

## Проверка после установки

После установки всех переменных:

1. Откройте https://shortsai.ru
2. Попробуйте подключить Google Drive интеграцию
3. Ошибка "Google OAuth credentials not configured" должна исчезнуть

## Дополнительная информация

- [Google OAuth Setup Guide](./GOOGLE_OAUTH_SETUP.md) - подробная инструкция
- [Google Drive Setup Guide](./GOOGLE_DRIVE_SETUP.md) - настройка Google Drive




