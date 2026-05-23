@echo off
echo Stopping Dremio Iceberg Migrator...

FOR /F "tokens=5" %%T IN ('netstat -ano ^| findstr :8771') DO (
    taskkill /PID %%T /F 2>nul
)

echo Stopped.
pause
