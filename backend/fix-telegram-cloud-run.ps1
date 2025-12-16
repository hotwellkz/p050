# 🔐 Скрипт для диагностики и исправления проблемы с Telegram на Cloud Run
# Использование: .\fix-telegram-cloud-run.ps1 [SERVICE_NAME] [REGION]

param(
    [string]$ServiceName = "shortsai-backend",
    [string]$Region = "us-central1"
)

Write-Host "🔍 Диагностика Telegram на Cloud Run..." -ForegroundColor Cyan
Write-Host "Сервис: $ServiceName" -ForegroundColor Yellow
Write-Host "Регион: $Region" -ForegroundColor Yellow
Write-Host ""

# Проверка наличия gcloud CLI
try {
    $gcloudVersion = gcloud --version 2>&1 | Select-Object -First 1
    Write-Host "✅ gcloud CLI установлен: $gcloudVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ОШИБКА: gcloud CLI не установлен!" -ForegroundColor Red
    exit 1
}

# Получаем переменные окружения
Write-Host "`n📋 Проверка переменных окружения Telegram..." -ForegroundColor Cyan
try {
    $envVars = gcloud run services describe $ServiceName --region $Region --format="get(spec.template.spec.containers[0].env)" | ConvertFrom-Json
    
    $telegramVars = @{
        TELEGRAM_API_ID = $false
        TELEGRAM_API_HASH = $false
        TELEGRAM_SESSION_SECRET = $false
        TELEGRAM_SESSION_ENCRYPTED = $false
    }
    
    foreach ($var in $envVars) {
        if ($telegramVars.ContainsKey($var.name)) {
            $telegramVars[$var.name] = $true
            if ($var.name -eq "TELEGRAM_SESSION_SECRET") {
                $secretLength = if ($var.value) { $var.value.Length } else { 0 }
                Write-Host "  ✅ $($var.name): установлен ($secretLength символов)" -ForegroundColor Green
            } elseif ($var.name -eq "TELEGRAM_SESSION_ENCRYPTED") {
                $encryptedLength = if ($var.value) { $var.value.Length } else { 0 }
                Write-Host "  ✅ $($var.name): установлен ($encryptedLength символов)" -ForegroundColor Green
            } else {
                Write-Host "  ✅ $($var.name): установлен" -ForegroundColor Green
            }
        }
    }
    
    Write-Host "`n📊 Статус переменных:" -ForegroundColor Cyan
    foreach ($key in $telegramVars.Keys) {
        if (-not $telegramVars[$key]) {
            Write-Host "  ❌ $key: НЕ установлен" -ForegroundColor Red
        }
    }
    
    # Проверка секретов
    Write-Host "`n🔐 Проверка секретов в Secret Manager..." -ForegroundColor Cyan
    $secrets = gcloud secrets list --filter="name~telegram" --format="value(name)" 2>&1
    if ($secrets) {
        Write-Host "  ✅ Найдены секреты Telegram:" -ForegroundColor Green
        $secrets | ForEach-Object { Write-Host "    - $_" -ForegroundColor Green }
    } else {
        Write-Host "  ⚠️  Секреты Telegram не найдены в Secret Manager" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ ОШИБКА при проверке переменных: $($_.Exception.Message)" -ForegroundColor Red
}

# Инструкции по исправлению
Write-Host "`n" -NoNewline
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "📝 ИНСТРУКЦИИ ПО ИСПРАВЛЕНИЮ" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

Write-Host "Проблема: 'Failed to decrypt telegram session'" -ForegroundColor Yellow
Write-Host "Причина: Отсутствуют или неправильно настроены переменные Telegram" -ForegroundColor Yellow
Write-Host ""

Write-Host "Шаг 1: Локальная авторизация Telegram" -ForegroundColor Cyan
Write-Host "1. Перейдите в директорию backend" -ForegroundColor White
Write-Host "2. Убедитесь, что .env настроен:" -ForegroundColor White
Write-Host "   TELEGRAM_API_ID=your-api-id" -ForegroundColor Gray
Write-Host "   TELEGRAM_API_HASH=your-api-hash" -ForegroundColor Gray
Write-Host "   TELEGRAM_SESSION_SECRET=your-64-char-hex-secret" -ForegroundColor Gray
Write-Host "3. Выполните логин:" -ForegroundColor White
Write-Host "   npm run dev:login" -ForegroundColor Gray
Write-Host "4. Экспортируйте сессию:" -ForegroundColor White
Write-Host "   npm run export:telegram-session" -ForegroundColor Gray
Write-Host ""

Write-Host "Шаг 2: Настройка переменных на Cloud Run" -ForegroundColor Cyan
Write-Host ""
Write-Host "Вариант A: Через Secret Manager (рекомендуется)" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Создайте секреты:" -ForegroundColor White
Write-Host "   # Секрет для TELEGRAM_SESSION_SECRET" -ForegroundColor Gray
Write-Host "   echo -n 'your-64-char-hex-secret' | gcloud secrets create telegram-session-secret --data-file=-" -ForegroundColor Gray
Write-Host ""
Write-Host "   # Секрет для TELEGRAM_SESSION_ENCRYPTED" -ForegroundColor Gray
Write-Host "   echo -n 'encrypted-session-value' | gcloud secrets create telegram-session-encrypted --data-file=-" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Подключите секреты к Cloud Run:" -ForegroundColor White
Write-Host "   gcloud run services update $ServiceName --region $Region --update-secrets `"TELEGRAM_SESSION_SECRET=telegram-session-secret:latest,TELEGRAM_SESSION_ENCRYPTED=telegram-session-encrypted:latest`"" -ForegroundColor Gray
Write-Host ""

Write-Host "Вариант B: Через переменные окружения" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Установите переменные:" -ForegroundColor White
Write-Host "   gcloud run services update $ServiceName --region $Region --update-env-vars `"TELEGRAM_API_ID=your-api-id,TELEGRAM_API_HASH=your-api-hash,TELEGRAM_SESSION_SECRET=your-64-char-hex-secret,TELEGRAM_SESSION_ENCRYPTED=encrypted-session-value`"" -ForegroundColor Gray
Write-Host ""

Write-Host "⚠️  ВАЖНО:" -ForegroundColor Red
Write-Host "- TELEGRAM_SESSION_SECRET должен быть одинаковым при шифровании и расшифровке" -ForegroundColor White
Write-Host "- TELEGRAM_SESSION_ENCRYPTED должен быть получен через 'npm run export:telegram-session'" -ForegroundColor White
Write-Host "- После настройки перезапустите сервис" -ForegroundColor White
Write-Host ""

Write-Host "Шаг 3: Проверка" -ForegroundColor Cyan
Write-Host "После настройки проверьте логи:" -ForegroundColor White
Write-Host "   gcloud run services logs read $ServiceName --region $Region --limit 50" -ForegroundColor Gray
Write-Host ""

Write-Host "=" * 60 -ForegroundColor Cyan




