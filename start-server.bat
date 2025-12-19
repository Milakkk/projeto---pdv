@echo off
echo ========================================
echo Iniciando servidor de desenvolvimento...
echo ========================================
echo.
cd apps\desktop
echo Diretorio atual: %CD%
echo.
echo Iniciando servidor na porta 3001...
echo Acesse: http://localhost:3001
echo.
echo Pressione Ctrl+C para parar o servidor
echo.
pnpm dev:browser
pause


