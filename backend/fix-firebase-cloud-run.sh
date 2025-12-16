#!/bin/bash
# 🔥 Скрипт для диагностики и исправления проблемы с Firebase Admin на Cloud Run
# Использование: ./fix-firebase-cloud-run.sh [SERVICE_NAME] [REGION]

SERVICE_NAME="${1:-shortsai-backend}"
REGION="${2:-us-central1}"

echo "🔍 Диагностика Firebase Admin на Cloud Run..."
echo "Сервис: $SERVICE_NAME"
echo "Регион: $REGION"
echo ""

# Проверка наличия gcloud CLI
if ! command -v gcloud &> /dev/null; then
    echo "❌ ОШИБКА: gcloud CLI не установлен!"
    echo "Установите: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "✅ gcloud CLI установлен: $(gcloud --version | head -n 1)"
echo ""

# Получаем URL сервиса
echo "📡 Получение URL сервиса..."
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)' 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ ОШИБКА: Не удалось получить информацию о сервисе"
    echo "Проверьте имя сервиса и регион"
    exit 1
fi

echo "✅ URL сервиса: $SERVICE_URL"
echo ""

# Проверка health/auth endpoint
echo "🏥 Проверка /health/auth..."
HEALTH_RESPONSE=$(curl -s "$SERVICE_URL/health/auth" 2>&1)

if [ $? -eq 0 ]; then
    echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
    echo ""
    
    if echo "$HEALTH_RESPONSE" | grep -q '"ok":true'; then
        echo "✅ Firebase Admin инициализирован успешно!"
        PROJECT_ID=$(echo "$HEALTH_RESPONSE" | jq -r '.projectId // "unknown"' 2>/dev/null)
        CRED_SOURCE=$(echo "$HEALTH_RESPONSE" | jq -r '.credentialSource // "unknown"' 2>/dev/null)
        echo "Project ID: $PROJECT_ID"
        echo "Credential Source: $CRED_SOURCE"
        exit 0
    else
        echo "❌ Firebase Admin НЕ инициализирован!"
        ERROR_MSG=$(echo "$HEALTH_RESPONSE" | jq -r '.message // "Unknown error"' 2>/dev/null)
        echo "Ошибка: $ERROR_MSG"
    fi
else
    echo "❌ ОШИБКА при проверке /health/auth"
    echo "Проверьте, что сервис запущен и доступен"
fi

# Проверка debug/auth endpoint (если доступен)
echo ""
echo "🔍 Проверка /internal/debug/auth..."
DEBUG_RESPONSE=$(curl -s "$SERVICE_URL/internal/debug/auth" 2>&1)

if [ $? -eq 0 ] && echo "$DEBUG_RESPONSE" | grep -q "firebaseInitialized"; then
    echo "Детальная диагностика:"
    echo "$DEBUG_RESPONSE" | jq '.' 2>/dev/null || echo "$DEBUG_RESPONSE"
    echo ""
    
    echo "📊 Статус переменных окружения:"
    HAS_SERVICE_ACCOUNT=$(echo "$DEBUG_RESPONSE" | jq -r '.env.hasFirebaseServiceAccount // false' 2>/dev/null)
    HAS_PROJECT_ID=$(echo "$DEBUG_RESPONSE" | jq -r '.env.hasFirebaseProjectId // false' 2>/dev/null)
    HAS_CLIENT_EMAIL=$(echo "$DEBUG_RESPONSE" | jq -r '.env.hasFirebaseClientEmail // false' 2>/dev/null)
    HAS_PRIVATE_KEY=$(echo "$DEBUG_RESPONSE" | jq -r '.env.hasFirebasePrivateKey // false' 2>/dev/null)
    
    [ "$HAS_SERVICE_ACCOUNT" = "true" ] && echo "  ✅ FIREBASE_SERVICE_ACCOUNT" || echo "  ❌ FIREBASE_SERVICE_ACCOUNT"
    [ "$HAS_PROJECT_ID" = "true" ] && echo "  ✅ FIREBASE_PROJECT_ID" || echo "  ❌ FIREBASE_PROJECT_ID"
    [ "$HAS_CLIENT_EMAIL" = "true" ] && echo "  ✅ FIREBASE_CLIENT_EMAIL" || echo "  ❌ FIREBASE_CLIENT_EMAIL"
    [ "$HAS_PRIVATE_KEY" = "true" ] && echo "  ✅ FIREBASE_PRIVATE_KEY" || echo "  ❌ FIREBASE_PRIVATE_KEY"
else
    echo "⚠️  Debug endpoint недоступен (это нормально для production)"
fi

# Проверка секретов в Secret Manager
echo ""
echo "🔐 Проверка секретов в Secret Manager..."
SECRETS=$(gcloud secrets list --filter="name~firebase" --format="value(name)" 2>&1)

if [ -n "$SECRETS" ]; then
    echo "✅ Найдены секреты Firebase:"
    echo "$SECRETS" | while read -r secret; do
        echo "  - $secret"
    done
else
    echo "⚠️  Секреты Firebase не найдены в Secret Manager"
fi

# Инструкции по исправлению
echo ""
echo "============================================================"
echo "📝 ИНСТРУКЦИИ ПО ИСПРАВЛЕНИЮ"
echo "============================================================"
echo ""

echo "Вариант 1: Использование Secret Manager (рекомендуется)"
echo ""
echo "1. Создайте секрет с Firebase Service Account JSON:"
echo "   gcloud secrets create firebase-service-account --data-file=path/to/service-account.json"
echo ""
echo "2. Подключите секрет к Cloud Run:"
echo "   gcloud run services update $SERVICE_NAME --region $REGION --update-secrets FIREBASE_SERVICE_ACCOUNT=firebase-service-account:latest"
echo ""

echo "Вариант 2: Использование переменных окружения"
echo ""
echo "1. Подготовьте Firebase Service Account JSON файл"
echo ""
echo "2. Установите переменные окружения:"
echo "   JSON_CONTENT=\$(cat path/to/service-account.json | jq -c .)"
echo "   gcloud run services update $SERVICE_NAME --region $REGION --update-env-vars FIREBASE_SERVICE_ACCOUNT=\"\$JSON_CONTENT\""
echo ""
echo "   ИЛИ используйте отдельные переменные:"
echo "   gcloud run services update $SERVICE_NAME --region $REGION --update-env-vars \"FIREBASE_PROJECT_ID=your-project-id,FIREBASE_CLIENT_EMAIL=your-email@project.iam.gserviceaccount.com,FIREBASE_PRIVATE_KEY=\\\"-----BEGIN PRIVATE KEY-----\\\\n...\\\\n-----END PRIVATE KEY-----\\\\n\\\"\""
echo ""

echo "Вариант 3: Использование Application Default Credentials (ADC)"
echo ""
echo "Если сервис запущен в Cloud Run с правильным Service Account:"
echo "   gcloud run services update $SERVICE_NAME --region $REGION --update-env-vars FIREBASE_USE_ADC=true,FIREBASE_PROJECT_ID=your-project-id"
echo ""

echo "После настройки проверьте снова:"
echo "   ./fix-firebase-cloud-run.sh $SERVICE_NAME $REGION"
echo ""

echo "============================================================"




