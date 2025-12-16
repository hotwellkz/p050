# 🔧 Быстрое решение: Google OAuth credentials not configured

## Проблема

Ошибка: "Google OAuth credentials not configured"

Система пытается использовать OAuth интеграцию пользователя, но для этого нужны `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`.

## Решение 1: Получить OAuth credentials (рекомендуется)

### Шаг 1: Создайте OAuth 2.0 Client ID

1. Откройте https://console.cloud.google.com/
2. Выберите проект `prompt-6a4fd`
3. Перейдите в **APIs & Services** → **Credentials**
4. Нажмите **Create Credentials** → **OAuth client ID**
5. Если появится экран настройки OAuth consent screen:
   - Выберите **External** (для тестирования)
   - Заполните обязательные поля (App name, User support email)
   - Добавьте свой email в Test users
   - Сохраните
6. Выберите **Web application**
7. Добавьте **Authorized redirect URIs**:
   - `https://shortsai.ru/google-drive/callback`
   - `http://localhost:5173/google-drive/callback` (для разработки)
8. Нажмите **Create**
9. Скопируйте **Client ID** и **Client Secret**

### Шаг 2: Установите на Cloud Run

```powershell
gcloud run services update shortsai-backend --region us-central1 `
  --update-env-vars "GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com,GOOGLE_CLIENT_SECRET=your-client-secret"
```

## Решение 2: Использовать Service Account (если OAuth не нужен)

Если у вас есть Service Account для Google Drive, можно использовать его напрямую. Но это работает только для папок, к которым Service Account имеет доступ.

Убедитесь, что установлены:
- `GOOGLE_DRIVE_CLIENT_EMAIL`
- `GOOGLE_DRIVE_PRIVATE_KEY`
- `GOOGLE_DRIVE_DEFAULT_PARENT` (ID папки)

## Решение 3: Временная заглушка (для тестирования)

Если нужно быстро протестировать, можно установить временные значения:

```powershell
gcloud run services update shortsai-backend --region us-central1 `
  --update-env-vars "GOOGLE_CLIENT_ID=temp-client-id,GOOGLE_CLIENT_SECRET=temp-client-secret"
```

⚠️ **Внимание:** С временными значениями OAuth интеграция не будет работать, но система переключится на Service Account (если он настроен).

## Текущий статус

- ✅ `GOOGLE_OAUTH_REDIRECT_URL` - установлен (`https://shortsai.ru/google-drive/callback`)
- ❌ `GOOGLE_CLIENT_ID` - **НЕ установлен** (нужно получить из Google Cloud Console)
- ❌ `GOOGLE_CLIENT_SECRET` - **НЕ установлен** (нужно получить из Google Cloud Console)

## После установки

После установки `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`:

1. Пользователям нужно будет подключить Google Drive через интерфейс
2. Ошибка "Google OAuth credentials not configured" исчезнет
3. Загрузка видео в Google Drive будет работать

## Альтернатива: Использовать только Service Account

Если не нужна персональная интеграция пользователей, можно использовать только Service Account:

1. Убедитесь, что установлены `GOOGLE_DRIVE_CLIENT_EMAIL` и `GOOGLE_DRIVE_PRIVATE_KEY`
2. Убедитесь, что Service Account имеет доступ к папкам Google Drive
3. Система автоматически переключится на Service Account, если OAuth не настроен




