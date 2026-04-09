@echo off
REM skget 构建脚本 (Windows)
REM 用途: 编译 TypeScript、验证构建产物

echo ==========================================
echo   skget 构建脚本
echo ==========================================

REM 进入项目目录
cd /d "%~dp0..\.."

REM 清理旧构建
echo 🗑️  清理旧构建产物...
if exist "dist" rmdir /s /q dist

REM 编译 TypeScript
echo 📦 编译 TypeScript...
call npm run build

REM 验证构建产物
echo.
echo 🔍 验证构建产物...

if not exist "dist" (
    echo ❌ 错误: dist 目录不存在
    exit /b 1
)

REM 检查关键文件
set MISSING=0

if exist "dist\index.js" (echo ✓ 存在: dist\index.js) else (echo ❌ 缺失: dist\index.js & set MISSING=1)
if exist "dist\core\storage.js" (echo ✓ 存在: dist\core\storage.js) else (echo ❌ 缺失: dist\core\storage.js & set MISSING=1)
if exist "dist\core\scanner.js" (echo ✓ 存在: dist\core\scanner.js) else (echo ❌ 缺失: dist\core\scanner.js & set MISSING=1)
if exist "dist\core\git-sync.js" (echo ✓ 存在: dist\core\git-sync.js) else (echo ❌ 缺失: dist\core\git-sync.js & set MISSING=1)
if exist "dist\commands\skill\index.js" (echo ✓ 存在: dist\commands\skill\index.js) else (echo ❌ 缺失: dist\commands\skill\index.js & set MISSING=1)
if exist "dist\commands\knowledge\index.js" (echo ✓ 存在: dist\commands\knowledge\index.js) else (echo ❌ 缺失: dist\commands\knowledge\index.js & set MISSING=1)

if %MISSING%==1 (
    echo.
    echo ❌ 构建验证失败: 存在缺失文件
    exit /b 1
)

echo.
echo ==========================================
echo   构建完成
echo ==========================================
echo.
echo 构建产物位于: dist\
echo.
echo 测试运行:
echo   node bin\skget.js --help
