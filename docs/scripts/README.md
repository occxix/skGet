# qskills 脚本说明

本目录包含项目开发、测试和构建的自动化脚本。

## 脚本列表

| 脚本文件 | 用途 | 平台 |
|----------|------|------|
| `dev-start.sh` | 开发环境启动 | Linux/macOS |
| `dev-start.bat` | 开发环境启动 | Windows |
| `test.sh` | 运行测试 | Linux/macOS |
| `test.bat` | 运行测试 | Windows |
| `build.sh` | 构建项目 | Linux/macOS |
| `build.bat` | 构建项目 | Windows |

---

## 开发环境启动脚本 (dev-start)

### 用途
一键初始化开发环境，包括：
- 检查 Node.js 版本（需要 16+）
- 安装 npm 依赖
- 编译 TypeScript
- 启动监听模式

### 使用方法

**Linux/macOS:**
```bash
chmod +x docs/scripts/dev-start.sh
./docs/scripts/dev-start.sh
```

**Windows:**
```cmd
docs\scripts\dev-start.bat
```

### 前置要求
- Node.js 16.0.0 或更高版本
- npm 8.0.0 或更高版本

---

## 测试脚本 (test)

### 用途
运行单元测试，支持多种模式。

### 使用方法

**Linux/macOS:**
```bash
# 运行所有测试
./docs/scripts/test.sh

# 监听模式（文件变更自动重跑）
./docs/scripts/test.sh --watch

# 生成覆盖率报告
./docs/scripts/test.sh --coverage
```

**Windows:**
```cmd
# 运行所有测试
docs\scripts\test.bat

# 监听模式
docs\scripts\test.bat --watch

# 生成覆盖率报告
docs\scripts\test.bat --coverage
```

### 参数说明

| 参数 | 简写 | 说明 |
|------|------|------|
| `--watch` | `-w` | 监听模式，文件变更时自动重新运行测试 |
| `--coverage` | `-c` | 生成覆盖率报告到 `coverage/` 目录 |
| `--help` | `-h` | 显示帮助信息 |

### 输出文件
- 覆盖率报告: `coverage/index.html`

---

## 构建脚本 (build)

### 用途
编译 TypeScript 并验证构建产物完整性。

### 使用方法

**Linux/macOS:**
```bash
./docs/scripts/build.sh
```

**Windows:**
```cmd
docs\scripts\build.bat
```

### 构建流程
1. 清理旧的 `dist/` 目录
2. 执行 TypeScript 编译
3. 验证关键构建产物存在

### 构建产物

编译后的文件位于 `dist/` 目录：

```
dist/
├── index.js              # 主入口
├── core/
│   ├── storage.js        # 存储管理
│   ├── scanner.js        # 安全扫描
│   ├── git-sync.js       # Git 同步
│   ├── config.js         # 配置管理
│   └── init.js           # 初始化引导
├── commands/
│   ├── skill/            # skill 命令
│   ├── knowledge/        # knowledge 命令
│   ├── config.js         # config 命令
│   └── sync.js           # sync 命令
├── types/                # 类型定义
└── utils/                # 工具函数
```

---

## npm scripts 对照

项目 `package.json` 中定义了以下 npm scripts：

| npm 命令 | 对应脚本 | 说明 |
|----------|----------|------|
| `npm run build` | `tsc` | 编译 TypeScript |
| `npm run dev` | `tsc --watch` | 监听模式编译 |
| `npm test` | `vitest run` | 运行测试 |
| `npm run test:watch` | `vitest` | 监听模式测试 |
| `npm run test:coverage` | `vitest run --coverage` | 生成覆盖率报告 |

---

## 快速开始

### 新开发者入门

```bash
# 1. 克隆项目
git clone <repository-url>
cd Qcli

# 2. 启动开发环境
./docs/scripts/dev-start.sh

# 3. 在新终端运行测试
./docs/scripts/test.sh --watch

# 4. 测试 CLI
node bin/qskills.js --help
```

### CI/CD 集成

```yaml
# GitHub Actions 示例
- name: Install dependencies
  run: npm install

- name: Build
  run: npm run build

- name: Test
  run: npm test
```

---

## 常见问题

### Q: 脚本权限被拒绝
```bash
chmod +x docs/scripts/*.sh
```

### Q: Windows 下脚本无法执行
确保使用 Git Bash 或在 CMD 中使用 `.bat` 文件。

### Q: Node.js 版本不兼容
使用 nvm 切换 Node.js 版本：
```bash
nvm install 20
nvm use 20
```

### Q: 依赖安装失败
尝试清理 npm 缓存：
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

*最后更新: 2026-04-09*
