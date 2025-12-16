# 🚀 Скрипт для установки переменных окружения из .env.production на Cloud Run
# Использование: .\setup-cloud-run-env.ps1 [ENV_FILE] [SERVICE_NAME] [REGION]

param(
    [string]$EnvFile = ".env.production",
    [string]$ServiceName = "shortsai-backend",
    [string]$Region = "us-central1"
)

Write-Host "🚀 Установка переменных окружения на Cloud Run..." -ForegroundColor Cyan
Write-Host "Файл: $EnvFile" -ForegroundColor Yellow
Write-Host "Сервис: $ServiceName" -ForegroundColor Yellow
Write-Host "Регион: $Region" -ForegroundColor Yellow
Write-Host ""

# Проверка наличия файла
if (-not (Test-Path $EnvFile)) {
    Write-Host "❌ ОШИБКА: Файл $EnvFile не найден!" -ForegroundColor Red
    Write-Host "Укажите правильный путь к файлу или создайте его." -ForegroundColor Yellow
    exit 1
}

# Чтение файла
Write-Host "📖 Чтение файла $EnvFile..." -ForegroundColor Cyan
$envContent = Get-Content $EnvFile -Raw

# Парсинг переменных
$envVars = @{}
$secrets = @{}

$lines = $envContent -split "`n"
foreach ($line in $lines) {
    $line = $line.Trim()
    
    # Пропускаем комментарии и пустые строки
    if ($line -eq "" -or $line.StartsWith("#")) {
        continue
    }
    
    # Парсим KEY=VALUE
    if ($line -match "^([^=]+)=(.*)$") {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        
        # Убираем кавычки если есть
        if ($value.StartsWith('"') -and $value.EndsWith('"')) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if ($value.StartsWith("'") -and $value.EndsWith("'")) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        
        # Определяем, что должно быть секретом
        $secretKeys = @(
            "TELEGRAM_SESSION_SECRET",
            "TELEGRAM_SESSION_ENCRYPTED",
            "FIREBASE_SERVICE_ACCOUNT",
            "GOOGLE_DRIVE_PRIVATE_KEY",
            "GOOGLE_CLIENT_SECRET",
            "OPENAI_API_KEY",
            "JWT_SECRET",
            "CRON_SECRET"
        )
        
        if ($secretKeys -contains $key -and $value -ne "" -and $value -notmatch "your-.*-here") {
            $secrets[$key] = $value
        } elseif ($value -ne "" -and $value -notmatch "your-.*-here") {
            $envVars[$key] = $value
        }
    }
}

Write-Host "✅ Найдено переменных окружения: $($envVars.Count)" -ForegroundColor Green
Write-Host "✅ Найдено секретов: $($secrets.Count)" -ForegroundColor Green
Write-Host ""

# Показываем что будет установлено
if ($envVars.Count -gt 0) {
    Write-Host "📋 Переменные окружения:" -ForegroundColor Cyan
    foreach ($key in $envVars.Keys) {
        $value = $envVars[$key]
        $displayValue = if ($value.Length -gt 50) { $value.Substring(0, 50) + "..." } else { $value }
        Write-Host "  - $key = $displayValue" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($secrets.Count -gt 0) {
    Write-Host "🔐 Секреты (будут созданы в Secret Manager):" -ForegroundColor Cyan
    foreach ($key in $secrets.Keys) {
        $value = $secrets[$key]
        $displayValue = if ($value.Length -gt 50) { $value.Substring(0, 50) + "..." } else { $value }
        Write-Host "  - $key = $displayValue" -ForegroundColor Gray
    }
    Write-Host ""
}

# Подтверждение
Write-Host "⚠️  ВНИМАНИЕ: Это обновит переменные окружения на Cloud Run!" -ForegroundColor Yellow
$confirm = Read-Host "Продолжить? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Отменено." -ForegroundColor Yellow
    exit 0
}

# Создание секретов
if ($secrets.Count -gt 0) {
    Write-Host "`n🔐 Создание секретов в Secret Manager..." -ForegroundColor Cyan
    
    foreach ($key in $secrets.Keys) {
        $secretName = $key.ToLower().Replace("_", "-")
        $value = $secrets[$key]
        
        Write-Host "  Создание секрета: $secretName..." -ForegroundColor Yellow
        
        # Проверяем, существует ли секрет
        $existingSecret = gcloud secrets list --filter="name=$secretName" --format="value(name)" 2>&1
        
        if ($existingSecret) {
            Write-Host "    Секрет уже существует, обновление версии..." -ForegroundColor Gray
            # Создаем новую версию
            echo -n $value | gcloud secrets versions add $secretName --data-file=- 2>&1 | Out-Null
        } else {
            # Создаем новый секрет
            echo -n $value | gcloud secrets create $secretName --data-file=- 2>&1 | Out-Null
            
            # Даем доступ Cloud Run
            $serviceAccount = "905027425668-compute@developer.gserviceaccount.com"
            gcloud secrets add-iam-policy-binding $secretName `
                --member="serviceAccount:$serviceAccount" `
                --role="roles/secretmanager.secretAccessor" 2>&1 | Out-Null
        }
        
        Write-Host "    ✅ Секрет $secretName создан/обновлен" -ForegroundColor Green
    }
}

# Подготовка команды для обновления переменных
Write-Host "`n📝 Обновление переменных окружения на Cloud Run..." -ForegroundColor Cyan

# Формируем список переменных для --update-env-vars
$envVarsList = @()
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    # Экранируем специальные символы
    $value = $value -replace '"', '\"'
    $envVarsList += "$key=$value"
}

# Формируем список секретов для --update-secrets
$secretsList = @()
foreach ($key in $secrets.Keys) {
    $secretName = $key.ToLower().Replace("_", "-")
    $secretsList += "$key=$secretName`:latest"
}

# Обновляем сервис
$updateCmd = "gcloud run services update $ServiceName --region $Region"

if ($envVarsList.Count -gt 0) {
    $envVarsString = $envVarsList -join ","
    $updateCmd += " --update-env-vars `"$envVarsString`""
}

if ($secretsList.Count -gt 0) {
    $secretsString = $secretsList -join ","
    if ($envVarsList.Count -gt 0) {
        $updateCmd += " --update-secrets `"$secretsString`""
    } else {
        $updateCmd += " --update-secrets `"$secretsString`""
    }
}

Write-Host "Выполнение команды..." -ForegroundColor Yellow
Write-Host $updateCmd -ForegroundColor Gray
Write-Host ""

Invoke-Expression $updateCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Переменные окружения успешно установлены!" -ForegroundColor Green
    Write-Host "`nПроверка статуса..." -ForegroundColor Cyan
    Start-Sleep -Seconds 5
    
    $url = gcloud run services describe $ServiceName --region $Region --format="value(status.url)" 2>&1
    Write-Host "URL сервиса: $url" -ForegroundColor Green
    
    Write-Host "`nПроверка /health/auth..." -ForegroundColor Cyan
    try {
        $health = Invoke-RestMethod -Uri "$url/health/auth" -Method Get -ErrorAction Stop
        if ($health.ok) {
            Write-Host "✅ Сервис работает корректно!" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Сервис отвечает, но есть проблемы: $($health.message)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️  Не удалось проверить health endpoint: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n❌ ОШИБКА при обновлении сервиса!" -ForegroundColor Red
    exit 1
}




