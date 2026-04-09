@echo off
REM sksync 开发环境启动脚本 (Windows)
REM 用途: 安装依赖、构建项目、启动开发模式

echo ==========================================
echo   sksync 开发环境启动
echo ==========================================

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Node.js，请先安装 Node.js 16+
    exit /b 1
)

for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_VERSION=%%a
echo ✓ Node.js 版本: %NODE_VERSION%

REM 进入项目目录
cd /d "%~dp0..\.."

REM 检查 node_modules
if not exist "node_modules" (
    echo.
    echo 📦 安装依赖...
    call npm install
    echo ✓ 依赖安装完成
) else (
    echo ✓ 依赖已存在，跳过安装
)

REM 构建项目
echo.
echo 🔨 构建项目...
call npm run build
echo ✓ 构建完成

REM 开发模式提示
echo.
echo ==========================================
echo   开发环境准备就绪
echo ==========================================
echo.
echo 可用命令:
echo   npm run dev          # 监听模式编译
echo   npm run test         # 运行测试
echo   npm run test:watch   # 监听模式测试
echo   node bin/sksync.js  # 运行 CLI
echo.
echo 开发命令示例:
echo   node bin/sksync.js --help
echo   node bin/sksync.js config init
echo   node bin/sksync.js skill list
echo.

REM 启动开发监听
echo 启动 TypeScript 监听模式...
call npm run dev
