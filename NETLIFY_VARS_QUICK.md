# 🚀 Быстрая настройка переменных окружения в Netlify

## 📋 Минимальный набор переменных (обязательно)

Скопируйте эти переменные в Netlify Dashboard → Site settings → Environment variables:

```env
# Firebase (ОБЯЗАТЕЛЬНО)
VITE_FIREBASE_API_KEY=AIzaSy...your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=prompt-6a4fd.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=prompt-6a4fd
VITE_FIREBASE_STORAGE_BUCKET=prompt-6a4fd.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=905027425668
VITE_FIREBASE_APP_ID=1:905027425668:web:38f58912370df2c2be39d1

# Backend URL (ОБЯЗАТЕЛЬНО)
VITE_API_BASE_URL=https://shortsai-backend-rhnx5gonwq-uc.a.run.app
```

## 📝 Где получить Firebase API Key?

1. Откройте https://console.firebase.google.com/
2. Выберите проект `prompt-6a4fd`
3. Перейдите в **Project Settings** → **Your apps** → **Web app**
4. Скопируйте значение `apiKey` из раздела **SDK setup and configuration**

## ✅ После добавления

1. Сохраните переменные
2. Запустите новый деплой: **Deploys** → **Trigger deploy** → **Deploy site**
3. Проверьте в консоли браузера (F12):
   - ✅ `🔥 Firebase конфигурация: {...}`
   - ✅ `✅ Firebase успешно инициализирован`
   - ✅ `[API Config] Using API base URL: https://shortsai-backend-rhnx5gonwq-uc.a.run.app`

## ⚠️ Важно

- Все переменные должны начинаться с `VITE_`
- Не используйте `VITE_FIREBASE_APY_KEY` (с опечаткой) - правильное имя `VITE_FIREBASE_API_KEY`
- После изменения переменных обязательно пересоберите проект




