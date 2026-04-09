@echo off
REM sksync 测试脚本 (Windows)
REM 用途: 运行单元测试、生成覆盖率报告

echo ==========================================
echo   sksync 测试套件
echo ==========================================

REM 进入项目目录
cd /d "%~dp0..\.."

REM 解析参数
set MODE=run
set COVERAGE=false

:parse_args
if "%~1"=="" goto run_test
if "%~1"=="--watch" (set MODE=watch & shift & goto parse_args)
if "%~1"=="-w" (set MODE=watch & shift & goto parse_args)
if "%~1"=="--coverage" (set COVERAGE=true & shift & goto parse_args)
if "%~1"=="-c" (set COVERAGE=true & shift & goto parse_args)
if "%~1"=="--help" goto show_help
if "%~1"=="-h" goto show_help
echo 未知参数: %~1
exit /b 1

:show_help
echo 用法: %~nx0 [选项]
echo.
echo 选项:
echo   --watch, -w     监听模式，文件变更时自动重跑
echo   --coverage, -c  生成覆盖率报告
echo   --help, -h      显示帮助信息
exit /b 0

:run_test
REM 检查依赖
if not exist "node_modules" (
    echo 📦 安装依赖...
    call npm install
)

echo.

if "%MODE%"=="watch" (
    echo 🔄 启动监听模式...
    call npm run test:watch
) else if "%COVERAGE%"=="true" (
    echo 📊 运行测试并生成覆盖率报告...
    call npm run test:coverage
    echo.
    echo 覆盖率报告已生成到 coverage/ 目录
) else (
    echo 🧪 运行测试...
    call npm test
)

echo.
echo ✓ 测试完成
