# 🚀 Быстрый старт: Исправление Google OAuth Flow

## Что было исправлено

✅ State с HMAC подписью (безопасность)  
✅ Валидация state на callback  
✅ Сохранение returnTo и редирект обратно  
✅ Подробные логи с requestId  
✅ Правильное формирование redirect_uri из ENV  

## Команды для установки переменных

```powershell
# 1. Установите BACKEND_BASE_URL
gcloud run services update shortsai-backend --region us-central1 --update-env-vars "BACKEND_BASE_URL=https://shortsai-backend-905027425668.us-central1.run.app"

# 2. Убедитесь, что FRONTEND_ORIGIN установлен
gcloud run services update shortsai-backend --region us-central1 --update-env-vars "FRONTEND_ORIGIN=https://shortsai.ru"

# 3. (Опционально) Установите GOOGLE_REDIRECT_PATH, если нужно изменить путь
gcloud run services update shortsai-backend --region us-central1 --update-env-vars "GOOGLE_REDIRECT_PATH=/api/integrations/google-drive/callback"
```

## Настройка Google Cloud Console

### 1. Откройте OAuth Client
- [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
- Найдите ваш OAuth 2.0 Client ID

### 2. Authorized JavaScript origins
Добавьте:
```
https://shortsai.ru
https://shortsai-backend-905027425668.us-central1.run.app
```

### 3. Authorized redirect URIs
**УДАЛИТЕ** старый:
```
https://shortsai.ru/google-drive/callback
```

**ДОБАВЬТЕ** новый:
```
https://shortsai-backend-905027425668.us-central1.run.app/api/integrations/google-drive/callback
```

### 4. Сохраните изменения

## Проверка

1. Откройте `https://shortsai.ru/settings`
2. Нажмите "Подключить Google Drive"
3. После авторизации вы должны вернуться на `/settings?drive=connected`
4. Статус должен показывать "Google Drive подключен"

## Логи для отладки

```powershell
gcloud run services logs read shortsai-backend --region us-central1 --limit 50 | Select-String "oauth|callback"
```

## Полная документация

См. `backend/GOOGLE_OAUTH_FLOW_FIX.md` для подробной информации.




