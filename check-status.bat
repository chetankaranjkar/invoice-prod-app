@echo off
echo ========================================
echo Invoice Master - Container Status Check
echo ========================================
echo.

echo Checking Docker containers...
docker-compose ps
echo.

echo Checking API container logs (last 30 lines)...
echo ----------------------------------------
docker-compose logs api --tail=30
echo.

echo Testing API health endpoint...
curl http://localhost:5001/health
echo.
echo.

echo Testing Frontend...
curl http://localhost/health
echo.
echo.

echo Checking if ports are in use...
netstat -ano | findstr ":5001 :80 :1433"
echo.

pause
