# 🔧 Быстрое исправление 404 на Netlify

## Проблема
При открытии https://shortsai.ru видна ошибка "Page not found".

## Причина
Фронтенд не задеплоен на Netlify или деплой не завершился успешно.

## ✅ Решение (самый быстрый способ)

### Вариант 1: Через Netlify Dashboard (5 минут)

1. **Откройте [Netlify Dashboard](https://app.netlify.com)**

2. **Если сайт уже подключен:**
   - Откройте ваш сайт
   - Перейдите в **Deploys**
   - Нажмите **Trigger deploy** → **Deploy site**
   - Дождитесь завершения деплоя

3. **Если сайт не подключен:**
   - Нажмите **Add new site** → **Import an existing project**
   - Выберите **GitHub** → репозиторий `hotwellkz/p046`
   - Настройки:
     - Base directory: (пусто)
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Добавьте переменные окружения (см. ниже)
   - Нажмите **Deploy site**

### Вариант 2: Через Netlify CLI (если установлен)

```powershell
netlify deploy --prod
```

## 🔑 Обязательные переменные окружения

В Netlify Dashboard → **Site settings** → **Environment variables**:

```
VITE_FIREBASE_API_KEY=AIzaSyCtAg...s0sQ
VITE_FIREBASE_AUTH_DOMAIN=prompt-6a4fd.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=prompt-6a4fd
VITE_FIREBASE_STORAGE_BUCKET=prompt-6a4fd.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=905027425668
VITE_FIREBASE_APP_ID=1:905027425668:web:38f58912370df2c2be39d1
VITE_API_BASE_URL=https://shortsai-backend-905027425668.us-central1.run.app
```

**Важно:** Все переменные должны начинаться с `VITE_`!

## ✅ Проверка после деплоя

1. Откройте https://shortsai.ru
2. Должна открыться главная страница (не 404)
3. В консоли браузера (F12) должно быть:
   - `🔥 Firebase конфигурация: {...}`
   - `✅ Firebase успешно инициализирован`
   - `[API Config] Using API base URL: https://shortsai-backend-905027425668.us-central1.run.app`

## 📋 Файлы конфигурации (уже настроены)

- ✅ `netlify.toml` - настройки сборки и redirects
- ✅ `public/_redirects` - SPA redirects (копируется в dist)

Эти файлы уже настроены правильно, нужно только задеплоить!

