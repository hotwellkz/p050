# 🔐 Исправление ошибки "Failed to decrypt telegram session"

## Проблема

При отправке промпта в Syntx появляется ошибка:
```
POST /api/telegram/sendPromptToSyntx 500 (Internal Server Error)
Ошибка: Failed to decrypt telegram session
```

## Причина

Ошибка возникает, когда на Cloud Run не настроены или неправильно настроены переменные окружения для Telegram:
- `TELEGRAM_SESSION_SECRET` - секрет для расшифровки сессии (64 hex символа)
- `TELEGRAM_SESSION_ENCRYPTED` - зашифрованная сессия (для старого способа)
- `TELEGRAM_API_ID` - ID Telegram API
- `TELEGRAM_API_HASH` - Hash Telegram API

**Важно:** Сессия Telegram хранится в базе данных (Firestore) в зашифрованном виде. Для расшифровки используется `TELEGRAM_SESSION_SECRET`. Если этот секрет не совпадает с тем, который использовался при шифровании, расшифровка не удастся.

## Решение

### Шаг 1: Проверка текущих переменных

Запустите скрипт диагностики:
```powershell
cd backend
.\fix-telegram-cloud-run.ps1
```

Или проверьте вручную:
```powershell
gcloud run services describe shortsai-backend --region us-central1 --format="yaml(spec.template.spec.containers[0].env)"
```

### Шаг 2: Настройка переменных

#### Вариант A: Через Secret Manager (рекомендуется)

1. **Создайте секрет для TELEGRAM_SESSION_SECRET:**
   ```powershell
   # Сгенерируйте секрет (64 hex символа)
   $secret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Создайте секрет в Secret Manager
   echo -n $secret | gcloud secrets create telegram-session-secret --data-file=-
   ```

2. **Дайте доступ Cloud Run к секрету:**
   ```powershell
   gcloud secrets add-iam-policy-binding telegram-session-secret `
     --member="serviceAccount:905027425668-compute@developer.gserviceaccount.com" `
     --role="roles/secretmanager.secretAccessor"
   ```

3. **Подключите секрет к Cloud Run:**
   ```powershell
   gcloud run services update shortsai-backend --region us-central1 `
     --update-secrets TELEGRAM_SESSION_SECRET=telegram-session-secret:latest
   ```

#### Вариант B: Через переменные окружения

```powershell
# Сгенерируйте секрет
$secret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Установите переменные
gcloud run services update shortsai-backend --region us-central1 `
  --update-env-vars "TELEGRAM_SESSION_SECRET=$secret,TELEGRAM_API_ID=your-api-id,TELEGRAM_API_HASH=your-api-hash"
```

### Шаг 3: Перешифровка сессий в базе данных

**⚠️ ВАЖНО:** Если вы изменили `TELEGRAM_SESSION_SECRET`, все существующие сессии в базе данных нужно перешифровать!

1. **Получите старый секрет** (если он был)
2. **Расшифруйте все сессии** старым секретом
3. **Зашифруйте новым секретом**
4. **Обновите в базе данных**

Или проще: попросите пользователей заново подключить Telegram через интерфейс.

### Шаг 4: Проверка

После настройки проверьте логи:
```powershell
gcloud run services logs read shortsai-backend --region us-central1 --limit 50
```

Ищите сообщения:
- ✅ `Telegram client connected` - успех
- ❌ `Failed to decrypt telegram session` - проблема с секретом
- ❌ `TELEGRAM_SESSION_SECRET is not set` - секрет не установлен

## Альтернативное решение: Использование нового секрета

Если вы не знаете старый секрет:

1. **Сгенерируйте новый секрет:**
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Установите его на Cloud Run** (см. Шаг 2)

3. **Попросите пользователей заново подключить Telegram:**
   - В интерфейсе: Настройки → Интеграции → Telegram → Отключить → Подключить заново

## Проверка в браузере

После настройки:
1. Откройте https://shortsai.ru
2. Попробуйте отправить промпт в Syntx
3. Ошибка "Failed to decrypt telegram session" должна исчезнуть

## Дополнительная информация

- [TELEGRAM_CLOUD_RUN_SETUP.md](./TELEGRAM_CLOUD_RUN_SETUP.md) - подробная инструкция по настройке Telegram
- [env.example](./env.example) - пример переменных окружения




