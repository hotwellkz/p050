# 🔥 Скрипт для диагностики и исправления проблемы с Firebase Admin на Cloud Run
# Использование: .\fix-firebase-cloud-run.ps1 [SERVICE_NAME] [REGION]

param(
    [string]$ServiceName = "shortsai-backend",
    [string]$Region = "us-central1"
)

Write-Host "🔍 Диагностика Firebase Admin на Cloud Run..." -ForegroundColor Cyan
Write-Host "Сервис: $ServiceName" -ForegroundColor Yellow
Write-Host "Регион: $Region" -ForegroundColor Yellow
Write-Host ""

# Проверка наличия gcloud CLI
try {
    $gcloudVersion = gcloud --version 2>&1 | Select-Object -First 1
    Write-Host "✅ gcloud CLI установлен: $gcloudVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ОШИБКА: gcloud CLI не установлен!" -ForegroundColor Red
    Write-Host "Установите: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Получаем URL сервиса
Write-Host "`n📡 Получение URL сервиса..." -ForegroundColor Cyan
try {
    $serviceUrl = gcloud run services describe $ServiceName --region $Region --format 'value(status.url)' 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ОШИБКА: Не удалось получить информацию о сервисе" -ForegroundColor Red
        Write-Host "Проверьте имя сервиса и регион" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ URL сервиса: $serviceUrl" -ForegroundColor Green
} catch {
    Write-Host "❌ ОШИБКА: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Проверка health/auth endpoint
Write-Host "`n🏥 Проверка /health/auth..." -ForegroundColor Cyan
try {
    $healthResponse = Invoke-RestMethod -Uri "$serviceUrl/health/auth" -Method Get -ErrorAction Stop
    Write-Host "Ответ:" -ForegroundColor Yellow
    $healthResponse | ConvertTo-Json -Depth 3 | Write-Host
    
    if ($healthResponse.ok -eq $true) {
        Write-Host "`n✅ Firebase Admin инициализирован успешно!" -ForegroundColor Green
        Write-Host "Project ID: $($healthResponse.projectId)" -ForegroundColor Green
        Write-Host "Credential Source: $($healthResponse.credentialSource)" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "`n❌ Firebase Admin НЕ инициализирован!" -ForegroundColor Red
        Write-Host "Ошибка: $($healthResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ОШИБКА при проверке /health/auth: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Проверьте, что сервис запущен и доступен" -ForegroundColor Yellow
}

# Проверка debug/auth endpoint (если доступен)
Write-Host "`n🔍 Проверка /internal/debug/auth..." -ForegroundColor Cyan
try {
    $debugResponse = Invoke-RestMethod -Uri "$serviceUrl/internal/debug/auth" -Method Get -ErrorAction Stop
    Write-Host "Детальная диагностика:" -ForegroundColor Yellow
    $debugResponse | ConvertTo-Json -Depth 3 | Write-Host
    
    Write-Host "`n📊 Статус переменных окружения:" -ForegroundColor Cyan
    Write-Host "  FIREBASE_SERVICE_ACCOUNT: $($debugResponse.env.hasFirebaseServiceAccount)" -ForegroundColor $(if ($debugResponse.env.hasFirebaseServiceAccount) { "Green" } else { "Red" })
    Write-Host "  FIREBASE_PROJECT_ID: $($debugResponse.env.hasFirebaseProjectId)" -ForegroundColor $(if ($debugResponse.env.hasFirebaseProjectId) { "Green" } else { "Red" })
    Write-Host "  FIREBASE_CLIENT_EMAIL: $($debugResponse.env.hasFirebaseClientEmail)" -ForegroundColor $(if ($debugResponse.env.hasFirebaseClientEmail) { "Green" } else { "Red" })
    Write-Host "  FIREBASE_PRIVATE_KEY: $($debugResponse.env.hasFirebasePrivateKey)" -ForegroundColor $(if ($debugResponse.env.hasFirebasePrivateKey) { "Green" } else { "Red" })
} catch {
    Write-Host "⚠️  Debug endpoint недоступен (это нормально для production)" -ForegroundColor Yellow
}

# Проверка секретов в Secret Manager
Write-Host "`n🔐 Проверка секретов в Secret Manager..." -ForegroundColor Cyan
try {
    $secrets = gcloud secrets list --filter="name~firebase" --format="value(name)" 2>&1
    if ($secrets) {
        Write-Host "✅ Найдены секреты Firebase:" -ForegroundColor Green
        $secrets | ForEach-Object { Write-Host "  - $_" -ForegroundColor Green }
    } else {
        Write-Host "⚠️  Секреты Firebase не найдены в Secret Manager" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Не удалось проверить секреты: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Инструкции по исправлению
Write-Host "`n" -NoNewline
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "📝 ИНСТРУКЦИИ ПО ИСПРАВЛЕНИЮ" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

Write-Host "Вариант 1: Использование Secret Manager (рекомендуется)" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Создайте секрет с Firebase Service Account JSON:" -ForegroundColor White
Write-Host "   gcloud secrets create firebase-service-account --data-file=path/to/service-account.json" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Подключите секрет к Cloud Run:" -ForegroundColor White
Write-Host "   gcloud run services update $ServiceName --region $Region --update-secrets FIREBASE_SERVICE_ACCOUNT=firebase-service-account:latest" -ForegroundColor Gray
Write-Host ""

Write-Host "Вариант 2: Использование переменных окружения" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Подготовьте Firebase Service Account JSON файл" -ForegroundColor White
Write-Host ""
Write-Host "2. Установите переменные окружения:" -ForegroundColor White
Write-Host "   `$jsonContent = Get-Content path/to/service-account.json -Raw" -ForegroundColor Gray
Write-Host "   gcloud run services update $ServiceName --region $Region --update-env-vars FIREBASE_SERVICE_ACCOUNT=`"`$jsonContent`"" -ForegroundColor Gray
Write-Host ""
Write-Host "   ИЛИ используйте отдельные переменные:" -ForegroundColor White
Write-Host "   gcloud run services update $ServiceName --region $Region --update-env-vars \"FIREBASE_PROJECT_ID=your-project-id,FIREBASE_CLIENT_EMAIL=your-email@project.iam.gserviceaccount.com,FIREBASE_PRIVATE_KEY=\`"-----BEGIN PRIVATE KEY-----\`n...\`n-----END PRIVATE KEY-----\`n\`"\"" -ForegroundColor Gray
Write-Host ""

Write-Host "Вариант 3: Использование Application Default Credentials (ADC)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Если сервис запущен в Cloud Run с правильным Service Account:" -ForegroundColor White
Write-Host "   gcloud run services update $ServiceName --region $Region --update-env-vars FIREBASE_USE_ADC=true,FIREBASE_PROJECT_ID=your-project-id" -ForegroundColor Gray
Write-Host ""

Write-Host "После настройки проверьте снова:" -ForegroundColor Yellow
Write-Host "   .\fix-firebase-cloud-run.ps1 $ServiceName $Region" -ForegroundColor Gray
Write-Host ""

Write-Host "=" * 60 -ForegroundColor Cyan




