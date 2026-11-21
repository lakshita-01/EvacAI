$ErrorActionPreference = 'Stop'

$pidFile = Join-Path (Join-Path $env:LOCALAPPDATA 'EvacAI') 'processes.json'
if (-not (Test-Path $pidFile)) {
    Write-Host 'No Evac-AI processes are recorded as running.'
    exit 0
}

$processes = @(Get-Content $pidFile -Raw | ConvertFrom-Json)
foreach ($process in $processes) {
    if (Get-Process -Id $process.id -ErrorAction SilentlyContinue) {
        Stop-Process -Id $process.id
        Write-Host "Stopped $($process.name)."
    }
}

Remove-Item $pidFile
Write-Host 'MongoDB remains running.'
