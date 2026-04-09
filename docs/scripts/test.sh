#!/bin/bash
# sksync 测试脚本
# 用途: 运行单元测试、生成覆盖率报告

set -e

echo "=========================================="
echo "  sksync 测试套件"
echo "=========================================="

# 进入项目目录
cd "$(dirname "$0")/../.."

# 解析参数
MODE="run"
COVERAGE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --watch|-w)
            MODE="watch"
            shift
            ;;
        --coverage|-c)
            COVERAGE=true
            shift
            ;;
        --help|-h)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --watch, -w     监听模式，文件变更时自动重跑"
            echo "  --coverage, -c  生成覆盖率报告"
            echo "  --help, -h      显示帮助信息"
            exit 0
            ;;
        *)
            echo "未知参数: $1"
            exit 1
            ;;
    esac
done

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

echo ""

if [ "$MODE" == "watch" ]; then
    echo "🔄 启动监听模式..."
    npm run test:watch
elif [ "$COVERAGE" == true ]; then
    echo "📊 运行测试并生成覆盖率报告..."
    npm run test:coverage
    echo ""
    echo "覆盖率报告已生成到 coverage/ 目录"
else
    echo "🧪 运行测试..."
    npm test
fi

echo ""
echo "✓ 测试完成"
