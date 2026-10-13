Write-Host "========================================" -ForegroundColor Cyan
Write-Host "     Adaptive Fitness - Mobile App      " -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$hasModules = (Test-Path "node_modules") -and (Test-Path "node_modules/expo") -and (Test-Path "node_modules/react-native-web")

if (-not $hasModules) {
    Write-Host "Installing dependencies with real-time progress bar..." -ForegroundColor Yellow
    npm install --progress=true
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Installation failed. Please check error above." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Dependencies verified! (no install needed)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting Expo Development Server..." -ForegroundColor Cyan
Write-Host "Once Metro bundles, open http://localhost:8081 in your browser." -ForegroundColor Yellow
Write-Host ""

npx expo start --web
