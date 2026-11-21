$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$runtimeDir = Join-Path $env:LOCALAPPDATA 'EvacAI'
$logDir = Join-Path $runtimeDir 'logs'
$pidFile = Join-Path $runtimeDir 'processes.json'
$processes = @()

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
if (Test-Path $pidFile) {
    $processes = @(Get-Content $pidFile -Raw | ConvertFrom-Json)
    $processes = @($processes | Where-Object {
        Get-Process -Id $_.id -ErrorAction SilentlyContinue
    })
}

function Test-HttpEndpoint([string]$url) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
    } catch {
        return $false
    }
}

function Start-LocalService(
    [string]$name,
    [string]$executable,
    [string]$arguments,
    [string]$workingDirectory,
    [int]$port,
    [string]$healthUrl
) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
        if (Test-HttpEndpoint $healthUrl) {
            Write-Host "$name is already responding on port $port."
            return
        }
        throw "Port $port is already in use, but $name did not pass its health check ($healthUrl)."
    }

    $stdout = Join-Path $logDir "$name.log"
    $stderr = Join-Path $logDir "$name-error.log"
    $process = Start-Process -FilePath $executable `
        -ArgumentList $arguments `
        -WorkingDirectory $workingDirectory `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -WindowStyle Hidden `
        -PassThru

    $script:processes += [PSCustomObject]@{ name = $name; id = $process.Id }
    $script:processes | ConvertTo-Json | Set-Content -Path $pidFile

    for ($attempt = 0; $attempt -lt 45; $attempt++) {
        Start-Sleep -Seconds 1
        if (Test-HttpEndpoint $healthUrl) {
            Write-Host "$name is ready on port $port."
            return
        }
        if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
            $details = Get-Content $stderr -ErrorAction SilentlyContinue | Select-Object -Last 20
            throw "$name exited during startup. See $stderr`n$($details -join "`n")"
        }
    }

    throw "$name did not become ready. See $stdout and $stderr."
}

$node = (Get-Command node.exe -ErrorAction Stop).Source
$python = (Get-Command python.exe -ErrorAction Stop).Source
$frontend = Join-Path $projectRoot 'frontend'
$backend = Join-Path $projectRoot 'backend'
$aiService = Join-Path $projectRoot 'ai-service'
$mapService = Join-Path $projectRoot 'map-service'

foreach ($directory in @(
    (Join-Path $frontend 'node_modules'),
    (Join-Path $backend 'node_modules')
)) {
    if (-not (Test-Path $directory)) {
        throw "Dependencies are missing at $directory. Run npm ci in that service directory first."
    }
}

& $python -c "import fastapi, uvicorn, ultralytics, ezdxf, shapely"
if ($LASTEXITCODE -ne 0) {
    throw 'Python service dependencies are missing. Run pip install -r requirements.txt in both Python service directories.'
}

$mongoCheck = "const mongoose=require('mongoose'); mongoose.connect('mongodb://127.0.0.1:27017/evacai',{serverSelectionTimeoutMS:2000}).then(()=>mongoose.disconnect()).then(()=>process.exit(0)).catch(()=>process.exit(1))"
Push-Location $backend
& $node -e $mongoCheck
$mongoReady = $LASTEXITCODE -eq 0
Pop-Location

if (-not $mongoReady) {
    $composeOutput = & docker compose -f (Join-Path $projectRoot 'docker-compose.yml') up -d 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "MongoDB failed to start:`n$($composeOutput -join "`n")"
    }
    $composeOutput | Write-Host
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Push-Location $backend
        & $node -e $mongoCheck
        $mongoReady = $LASTEXITCODE -eq 0
        Pop-Location
        if ($mongoReady) {
            break
        }
        Start-Sleep -Seconds 1
    }
    if (-not $mongoReady) {
        throw 'MongoDB did not become ready. Check Docker Desktop and docker compose logs.'
    }
}
Write-Host 'MongoDB is ready.'

Start-LocalService 'map-service' $python `
    '-m uvicorn app.main:app --host 127.0.0.1 --port 8001' `
    $mapService 8001 'http://127.0.0.1:8001/api/health'
Start-LocalService 'ai-service' $python `
    '-m uvicorn app.main:app --host 127.0.0.1 --port 8000' `
    $aiService 8000 'http://127.0.0.1:8000/api/health'
Start-LocalService 'backend' $node `
    'src/app.js' `
    $backend 3001 'http://127.0.0.1:3001/'
Start-LocalService 'frontend' $node `
    '.\node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173' `
    $frontend 5173 'http://127.0.0.1:5173/'

Write-Host ''
Write-Host 'Evac-AI is running at http://localhost:5173'
Write-Host "Service logs: $logDir"
Write-Host 'Stop the application with .\stop-local.ps1 (MongoDB remains running).'
