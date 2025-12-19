Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Iniciando servidor de desenvolvimento..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "apps\desktop"

Write-Host "Diretorio: $(Get-Location)" -ForegroundColor Yellow
Write-Host ""

# Verifica se node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias..." -ForegroundColor Yellow
    pnpm install
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "Servidor iniciando na porta 3001..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Acesse: " -NoNewline
Write-Host "http://localhost:3001" -ForegroundColor Cyan -BackgroundColor Black
Write-Host ""
Write-Host "Pressione Ctrl+C para parar" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

pnpm dev:browser


