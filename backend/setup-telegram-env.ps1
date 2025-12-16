# Установка Telegram переменных на Cloud Run

$ServiceName = "shortsai-backend"
$Region = "us-central1"

Write-Host "🔐 Настройка Telegram переменных на Cloud Run..." -ForegroundColor Cyan
Write-Host ""

# Генерация TELEGRAM_SESSION_SECRET
Write-Host "Генерация TELEGRAM_SESSION_SECRET..." -ForegroundColor Yellow
$secret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

if ($LASTEXITCODE -ne 0 -or $secret.Length -ne 64) {
    Write-Host "❌ Ошибка при генерации секрета" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Сгенерирован секрет: $($secret.Substring(0, 20))..." -ForegroundColor Green
Write-Host ""

# Создание секрета в Secret Manager
Write-Host "Создание секрета в Secret Manager..." -ForegroundColor Yellow
$secretBytes = [System.Text.Encoding]::UTF8.GetBytes($secret)
$secretBytes | gcloud secrets create telegram-session-secret --data-file=- 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Секрет создан" -ForegroundColor Green
} else {
    # Секрет уже существует, создаем новую версию
    Write-Host "⚠️  Секрет уже существует, создаем новую версию..." -ForegroundColor Yellow
    $secretBytes | gcloud secrets versions add telegram-session-secret --data-file=- 2>&1 | Out-Null
}

# Настройка прав доступа
Write-Host "Настройка прав доступа..." -ForegroundColor Yellow
gcloud secrets add-iam-policy-binding telegram-session-secret `
    --member="serviceAccount:905027425668-compute@developer.gserviceaccount.com" `
    --role="roles/secretmanager.secretAccessor" 2>&1 | Out-Null

Write-Host "✅ Права доступа настроены" -ForegroundColor Green
Write-Host ""

# Обновление Cloud Run сервиса
Write-Host "Обновление Cloud Run сервиса..." -ForegroundColor Yellow
gcloud run services update $ServiceName --region $Region `
    --update-secrets TELEGRAM_SESSION_SECRET=telegram-session-secret:latest

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Telegram переменные успешно установлены!" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  ВАЖНО:" -ForegroundColor Yellow
    Write-Host "Если у вас уже есть зашифрованные сессии в базе данных," -ForegroundColor Yellow
    Write-Host "они не смогут быть расшифрованы новым секретом." -ForegroundColor Yellow
    Write-Host "Попросите пользователей заново подключить Telegram." -ForegroundColor Yellow
} else {
    Write-Host "❌ Ошибка при обновлении сервиса" -ForegroundColor Red
    exit 1
}




