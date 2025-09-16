@echo off
cls
echo ═══════════════════════════════════════════════════════════════
echo         XENO SHOPIFY INTEGRATION - PROJECT INITIALIZATION
echo ═══════════════════════════════════════════════════════════════
echo.
echo This script will set up your entire development environment.
echo Please ensure you have completed Part 1 setup before continuing.
echo.
pause

cd /d "D:\Xeno App"

echo.
echo [Step 1/12] Installing root dependencies...
call npm init -y
call npm install concurrently rimraf --save-dev

echo.
echo [Step 2/12] Setting up Backend...
cd backend
call npm install
echo Backend dependencies installed.

echo.
echo [Step 3/12] Generating Prisma Client...
call npx prisma generate

echo.
echo [Step 4/12] Running database migrations...
call npx prisma migrate dev --name initial_setup

echo.
echo [Step 5/12] Seeding database...
call npx prisma db seed

echo.
echo [Step 6/12] Setting up Frontend...
cd ../frontend
call npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --use-npm
echo Frontend created.

echo.
echo [Step 7/12] Installing additional Frontend dependencies...
call npm install axios @tanstack/react-query chart.js react-chartjs-2 date-fns zustand
call npm install @radix-ui/react-alert-dialog @radix-ui/react-dialog @radix-ui/react-dropdown-menu
call npm install @radix-ui/react-label @radix-ui/react-select @radix-ui/react-tabs
call npm install class-variance-authority clsx tailwind-merge lucide-react
call npm install react-hook-form @hookform/resolvers zod
call npm install --save-dev @types/node

echo.
echo [Step 8/12] Setting up Shadcn UI...
call npx shadcn-ui@latest init -y

echo.
echo [Step 9/12] Creating environment files...
cd ..
copy .env.example backend\.env
copy .env.example frontend\.env.local

echo.
echo [Step 10/12] Configuring Git...
call git init
call git add .
call git commit -m "Initial project setup"

echo.
echo [Step 11/12] Opening VS Code...
code .

echo.
echo [Step 12/12] Starting development servers...
start cmd /k "cd backend && npm run dev"
timeout /t 5
start cmd /k "cd frontend && npm run dev"
timeout /t 5
start cmd /k "cd backend && npx prisma studio"

echo.
echo ═══════════════════════════════════════════════════════════════
echo              PROJECT INITIALIZATION COMPLETE!
echo ═══════════════════════════════════════════════════════════════
echo.
echo ✅ Backend server running at: http://localhost:5000
echo ✅ Frontend server running at: http://localhost:3000
echo ✅ Prisma Studio running at: http://localhost:5555
echo.
echo Next Steps:
echo 1. Update backend\.env with your Shop
