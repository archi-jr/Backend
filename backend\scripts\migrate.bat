@echo off
echo ════════════════════════════════════════════════════════════
echo           XENO APP - DATABASE MIGRATION SCRIPT
echo ════════════════════════════════════════════════════════════
echo.

cd /d "D:\Xeno App\backend"

echo [1] Installing dependencies...
call npm install

echo.
echo [2] Generating Prisma Client...
call npx prisma generate

echo.
echo [3] Creating database migrations...
call npx prisma migrate dev --name initial_schema

echo.
echo [4] Seeding database with sample data...
call npx prisma db seed

echo.
echo [5] Opening Prisma Studio...
start npx prisma studio

echo.
echo ════════════════════════════════════════════════════════════
echo           DATABASE SETUP COMPLETE!
echo ════════════════════════════════════════════════════════════
echo.
echo Prisma Studio is opening in your browser at http://localhost:5555
echo.
pause
