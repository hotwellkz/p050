# ✅ Установка переменных окружения на Cloud Run завершена

## Установленные переменные

### Базовые переменные окружения:
- ✅ `FIREBASE_PROJECT_ID=prompt-6a4fd`
- ✅ `FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@prompt-6a4fd.iam.gserviceaccount.com`
- ✅ `FRONTEND_ORIGIN=https://shortsai.ru`

### Секреты (уже установлены ранее):
- ✅ `FIREBASE_SERVICE_ACCOUNT` - через Secret Manager

## Что еще нужно настроить

### 1. Telegram переменные (для работы с SyntX)

Эти переменные имеют значения по умолчанию в `.env.production` и требуют реальных значений:

```powershell
# Получите на https://my.telegram.org/apps
TELEGRAM_API_ID=your-real-api-id
TELEGRAM_API_HASH=your-real-api-hash
SYNX_CHAT_ID=your-syntx-chat-id

# Сгенерируйте секрет (64 hex символа)
TELEGRAM_SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Получите после логина через: npm run export:telegram-session
TELEGRAM_SESSION_ENCRYPTED=your-encrypted-session
```

**Установка:**
```powershell
# Создайте секреты для чувствительных данных
echo -n "your-telegram-session-secret" | gcloud secrets create telegram-session-secret --data-file=-
echo -n "your-encrypted-session" | gcloud secrets create telegram-session-encrypted --data-file=-

# Дайте доступ Cloud Run
gcloud secrets add-iam-policy-binding telegram-session-secret `
  --member="serviceAccount:905027425668-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding telegram-session-encrypted `
  --member="serviceAccount:905027425668-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

# Установите переменные
gcloud run services update shortsai-backend --region us-central1 `
  --update-env-vars "TELEGRAM_API_ID=your-api-id,TELEGRAM_API_HASH=your-api-hash,SYNX_CHAT_ID=your-chat-id" `
  --update-secrets "TELEGRAM_SESSION_SECRET=telegram-session-secret:latest,TELEGRAM_SESSION_ENCRYPTED=telegram-session-encrypted:latest"
```

### 2. Google Drive переменные (опционально)

Если нужна интеграция с Google Drive:

```powershell
# Создайте секрет для private key
echo -n "your-private-key" | gcloud secrets create google-drive-private-key --data-file=-

gcloud secrets add-iam-policy-binding google-drive-private-key `
  --member="serviceAccount:905027425668-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

# Установите переменные
gcloud run services update shortsai-backend --region us-central1 `
  --update-env-vars "GOOGLE_DRIVE_CLIENT_EMAIL=your-email@project.iam.gserviceaccount.com,GOOGLE_DRIVE_DEFAULT_PARENT=your-folder-id" `
  --update-secrets "GOOGLE_DRIVE_PRIVATE_KEY=google-drive-private-key:latest"
```

### 3. Другие опциональные переменные

```powershell
# JWT и CRON секреты (если нужны)
echo -n "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-
echo -n "your-cron-secret" | gcloud secrets create cron-secret --data-file=-

gcloud secrets add-iam-policy-binding jwt-secret `
  --member="serviceAccount:905027425668-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding cron-secret `
  --member="serviceAccount:905027425668-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

gcloud run services update shortsai-backend --region us-central1 `
  --update-secrets "JWT_SECRET=jwt-secret:latest,CRON_SECRET=cron-secret:latest"
```

## Проверка

После установки всех переменных проверьте:

```powershell
# Проверка health endpoint
$url = "https://shortsai-backend-905027425668.us-central1.run.app"
Invoke-RestMethod -Uri "$url/health/auth" -Method Get

# Просмотр всех переменных
gcloud run services describe shortsai-backend --region us-central1 --format="yaml(spec.template.spec.containers[0].env)"
```

## Текущий статус

- ✅ Firebase Admin настроен и работает
- ✅ Базовые переменные окружения установлены
- ⚠️ Telegram переменные требуют реальных значений
- ⚠️ Google Drive переменные опциональны

## Следующие шаги

1. Настройте Telegram переменные (если нужна интеграция с SyntX)
2. Настройте Google Drive переменные (если нужна интеграция с Google Drive)
3. Проверьте работу API endpoints

## Дополнительная информация

- [FIX_FIREBASE_503.md](./FIX_FIREBASE_503.md) - настройка Firebase
- [FIX_TELEGRAM_DECRYPT_ERROR.md](./FIX_TELEGRAM_DECRYPT_ERROR.md) - настройка Telegram
- [TELEGRAM_CLOUD_RUN_SETUP.md](./TELEGRAM_CLOUD_RUN_SETUP.md) - подробная инструкция по Telegram




