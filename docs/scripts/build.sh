#!/bin/bash
# qskills 构建脚本
# 用途: 编译 TypeScript、验证构建产物

set -e

echo "=========================================="
echo "  qskills 构建脚本"
echo "=========================================="

# 进入项目目录
cd "$(dirname "$0")/../.."

# 清理旧构建
echo "🗑️  清理旧构建产物..."
rm -rf dist/

# 编译 TypeScript
echo "📦 编译 TypeScript..."
npm run build

# 验证构建产物
echo ""
echo "🔍 验证构建产物..."

if [ ! -d "dist" ]; then
    echo "❌ 错误: dist 目录不存在"
    exit 1
fi

# 检查关键文件
REQUIRED_FILES=(
    "dist/index.js"
    "dist/core/storage.js"
    "dist/core/scanner.js"
    "dist/core/git-sync.js"
    "dist/commands/skill/index.js"
    "dist/commands/knowledge/index.js"
)

MISSING_FILES=0
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ 缺失: $file"
        MISSING_FILES=$((MISSING_FILES + 1))
    else
        echo "✓ 存在: $file"
    fi
done

if [ $MISSING_FILES -gt 0 ]; then
    echo ""
    echo "❌ 构建验证失败: 缺失 $MISSING_FILES 个文件"
    exit 1
fi

echo ""
echo "=========================================="
echo "  构建完成"
echo "=========================================="
echo ""
echo "构建产物位于: dist/"
echo ""
echo "测试运行:"
echo "  node bin/qskills.js --help"
