#!/bin/bash
# skget 开发环境启动脚本
# 用途: 安装依赖、构建项目、启动开发模式

set -e

echo "=========================================="
echo "  skget 开发环境启动"
echo "=========================================="

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ 错误: 需要 Node.js 16 或更高版本"
    echo "   当前版本: $(node -v)"
    exit 1
fi
echo "✓ Node.js 版本: $(node -v)"

# 进入项目目录
cd "$(dirname "$0")/../.."

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 安装依赖..."
    npm install
    echo "✓ 依赖安装完成"
else
    echo "✓ 依赖已存在，跳过安装"
fi

# 构建项目
echo ""
echo "🔨 构建项目..."
npm run build
echo "✓ 构建完成"

# 开发模式提示
echo ""
echo "=========================================="
echo "  开发环境准备就绪"
echo "=========================================="
echo ""
echo "可用命令:"
echo "  npm run dev          # 监听模式编译"
echo "  npm run test         # 运行测试"
echo "  npm run test:watch   # 监听模式测试"
echo "  node bin/skget.js  # 运行 CLI"
echo ""
echo "开发命令示例:"
echo "  node bin/skget.js --help"
echo "  node bin/skget.js config init"
echo "  node bin/skget.js skill list"
echo ""

# 启动开发监听
echo "启动 TypeScript 监听模式..."
npm run dev
