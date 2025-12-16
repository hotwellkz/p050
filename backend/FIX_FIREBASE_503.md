# 🔥 Исправление ошибки "Firebase Admin not initialized" (503)

## Проблема

Все запросы к API возвращают `503 Service Unavailable` с сообщением "Firebase Admin not initialized".

**Причина:** Firebase Admin SDK не инициализирован на бэкенде, потому что отсутствуют необходимые переменные окружения с учетными данными Firebase.

## Быстрое решение

### Шаг 1: Диагностика

Запустите скрипт диагностики:

**Windows (PowerShell):**
```powershell
cd backend
.\fix-firebase-cloud-run.ps1
```

**Linux/Mac:**
```bash
cd backend
chmod +x fix-firebase-cloud-run.sh
./fix-firebase-cloud-run.sh
```

Скрипт покажет:
- Текущий статус Firebase Admin
- Какие переменные окружения отсутствуют
- Инструкции по исправлению

### Шаг 2: Настройка Firebase Credentials

Выберите один из вариантов:

#### Вариант 1: Secret Manager (рекомендуется для продакшена)

1. **Создайте секрет с Firebase Service Account JSON:**
   ```powershell
   gcloud secrets create firebase-service-account --data-file=path/to/service-account.json
   ```

2. **Подключите секрет к Cloud Run:**
   ```powershell
   gcloud run services update shortsai-backend --region us-central1 --update-secrets FIREBASE_SERVICE_ACCOUNT=firebase-service-account:latest
   ```

#### Вариант 2: Переменные окружения

1. **Подготовьте Firebase Service Account JSON файл:**
   - Откройте https://console.firebase.google.com/
   - Выберите проект → Project Settings → Service Accounts
   - Нажмите "Generate new private key"
   - Сохраните JSON файл

2. **Установите переменную окружения (PowerShell):**
   ```powershell
   $jsonContent = Get-Content path/to/service-account.json -Raw
   gcloud run services update shortsai-backend --region us-central1 --update-env-vars FIREBASE_SERVICE_ACCOUNT="$jsonContent"
   ```

   **ИЛИ используйте отдельные переменные:**
   ```powershell
   gcloud run services update shortsai-backend --region us-central1 --update-env-vars `
     FIREBASE_PROJECT_ID=your-project-id,`
     FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com,`
     FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

#### Вариант 3: Application Default Credentials (ADC)

Если сервис запущен в Cloud Run с правильным Service Account:

```powershell
gcloud run services update shortsai-backend --region us-central1 --update-env-vars `
  FIREBASE_USE_ADC=true,`
  FIREBASE_PROJECT_ID=your-project-id
```

### Шаг 3: Проверка

После настройки проверьте снова:

```powershell
.\fix-firebase-cloud-run.ps1
```

Или проверьте вручную:

```powershell
$SERVICE_URL = gcloud run services describe shortsai-backend --region us-central1 --format 'value(status.url)'
curl "$SERVICE_URL/health/auth"
```

Должно вернуть:
```json
{
  "ok": true,
  "code": "AUTH_OK",
  "projectId": "your-project-id",
  "credentialSource": "FIREBASE_SERVICE_ACCOUNT"
}
```

## Проверка в браузере

1. Обновите страницу https://shortsai.ru
2. Откройте DevTools → Network
3. Проверьте, что запросы теперь возвращают `200` или `401` (не `503`)

## Дополнительная диагностика

Если проблема сохраняется, проверьте логи Cloud Run:

```powershell
gcloud run services logs read shortsai-backend --region us-central1 --limit 50
```

Ищите сообщения:
- ✅ `Firebase Admin initialized` - успех
- ❌ `Failed to parse FIREBASE_SERVICE_ACCOUNT JSON` - проблема с форматом JSON
- ❌ `Firebase Admin not initialized` - проблема с credentials

## Полезные ссылки

- [QUICK_FIX_FIREBASE.md](./QUICK_FIX_FIREBASE.md) - подробная инструкция
- [FIREBASE_CONNECTION_ISSUE.md](./FIREBASE_CONNECTION_ISSUE.md) - решение проблем с подключением
- [env.example](./env.example) - пример переменных окружения




