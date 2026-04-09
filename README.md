# sksync (sksync)

一款面向个人开发者的 CLI 技能管理工具，支持多 AI 编程助手的技能、知识库、Agent 配置的统一管理与多源同步。

## 核心特性

- **多环境支持** - 支持 Claude Code、Cursor、通义灵码、OpenAI Codex、CodeBuddy Code 等 6 个 AI 环境
- **一站式管理** - 技能脚本、代码片段、知识笔记、Agent 配置统一管理
- **多源同步** - 公共资源与私人资源分类同步到 Git 仓库
- **即取即用** - npx 一键调用，无需全局安装
- **安全可控** - 敏感信息自动检测，防止意外泄露

---

## 快速开始

### 方式一：npx 直接使用（推荐）

无需安装，直接运行：

```bash
# 查看帮助
npx sksync --help

# 初始化配置（首次使用必须）
npx sksync config init
```

### 方式二：全局安装

```bash
npm install -g sksync
sksync --help
```

---

## 支持的 AI 环境

| 环境 | 名称 | 配置目录 | 说明 |
|------|------|----------|------|
| `claude` | Claude Code | `~/.claude` | Anthropic Claude Code |
| `cursor` | Cursor | `~/.cursor` | Cursor AI 编辑器 |
| `qwen` | 通义灵码 | `~/.qwen` | 阿里云通义灵码 |
| `codex` | OpenAI Codex | `~/.codex` | OpenAI Codex |
| `codebuddy` | CodeBuddy Code | `~/.codebuddy` | 腾讯 CodeBuddy |
| `common` | 通用技能 | 跨环境共享 | 适用于所有环境 |

---

## 使用指南

### 1. 初始化配置

首次使用必须先初始化：

```bash
npx sksync config init
```

按提示完成配置，配置文件位于 `~/.qcli/config.json`。

### 2. 查看可用环境

```bash
npx sksync skill envs
```

输出示例：
```
┌─────────────┬────────────────┬───────────┬──────────┐
│ 环境        │ 名称           │ 配置目录  │ 状态     │
├─────────────┼────────────────┼───────────┼──────────┤
│ claude      │ Claude Code    │ .claude   │ ✓ 启用   │
│ cursor      │ Cursor         │ .cursor   │ ✓ 启用   │
│ qwen        │ 通义灵码       │ .qwen     │ ✓ 启用   │
│ codex       │ OpenAI Codex   │ .codex    │ ✓ 启用   │
│ codebuddy   │ CodeBuddy Code │ .codebuddy│ ✓ 启用   │
│ common      │ 通用技能       │ (跨环境)  │ ✓ 启用   │
└─────────────┴────────────────┴───────────┴──────────┘
```

---

## 技能管理

> **短命令**：`skill` 可缩写为 `s`，如 `sksync s add`、`sksync s list`

### 添加技能

```bash
# 基本用法：添加到指定环境
npx sksync skill add ./my-script.js --name my-script --env claude

# 添加文件夹技能
npx sksync skill add ./my-project --name my-project --type folder --env cursor

# 添加到所有环境
npx sksync skill add ./my-tool.js --name my-tool --all

# 完整参数示例
npx sksync skill add ./tool.py \
  --name my-tool \
  --env codebuddy \
  --source private \
  --tags python,automation \
  --description "自动化工具脚本"
```

**参数说明：**

| 参数 | 简写 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| `--name` | `-n` | ✓ | 技能名称 | - |
| `--env` | `-e` | ✓ | 目标环境 | common |
| `--type` | `-t` | | single / folder | single |
| `--source` | `-s` | | public / private | private |
| `--tags` | | | 标签（逗号分隔） | - |
| `--description` | | | 描述信息 | - |
| `--skip-scan` | | | 跳过安全扫描 | false |

### 列出技能

```bash
# 列出所有技能
npx sksync skill list

# 筛选特定环境
npx sksync skill list --env cursor

# 筛选特定来源
npx sksync skill list --source public

# 按标签筛选
npx sksync skill list --tags python,automation

# JSON 格式输出（便于脚本处理）
npx sksync skill list --json
```

### 复制技能到其他环境

```bash
# 将技能从 claude 环境复制到 cursor 环境
npx sksync skill copy my-script --from claude --to cursor

# 从公共库安装到指定环境
npx sksync skill install api-helper --env qwen
```

### 删除技能

```bash
# 删除技能（需确认）
npx sksync skill remove my-script

# 强制删除（无需确认）
npx sksync skill remove my-script --force

# 指定环境删除
npx sksync skill remove my-script --env claude
```

---

## 知识库管理

> **短命令**：`knowledge` 可缩写为 `k`，如 `sksync k add`、`sksync k list`

### 添加知识条目

```bash
# 添加文档
npx sksync knowledge add ./article.md \
  --title "API 设计指南" \
  --type document \
  --category api \
  --tags api,design

# 添加代码片段
npx sksync knowledge add ./snippet.js \
  --title "工具函数集合" \
  --type code-snippet \
  --category utils \
  --tags javascript,utils

# 添加项目模板
npx sksync knowledge add ./template/ \
  --title "React 项目模板" \
  --type template \
  --category frontend \
  --tags react,template
```

**知识类型：**

| 类型 | 说明 | 用途 |
|------|------|------|
| `document` | 文档 | 技术文档、笔记 |
| `code-snippet` | 代码片段 | 可复用代码 |
| `template` | 模板 | 项目模板、配置模板 |
| `note` | 笔记 | 快速记录 |

### 列出知识条目

```bash
# 列出所有
npx sksync knowledge list

# 按类型筛选
npx sksync knowledge list --type code-snippet

# 按分类筛选
npx sksync knowledge list --category api

# 按环境筛选
npx sksync knowledge list --env claude
```

### 搜索知识

```bash
npx sksync knowledge search "API" --category backend
```

### 删除知识条目

```bash
npx sksync knowledge remove <id>
```

---

## Agent 管理

> **短命令**：`agent` 可缩写为 `a`，如 `sksync a add`、`sksync a list`

### 添加 Agent 配置

```bash
npx sksync agent add ./agent-config/ \
  --name code-reviewer \
  --env claude \
  --tags review,code-quality
```

### 列出 Agent

```bash
npx sksync agent list --env claude
```

---

## 同步功能

### 配置远程仓库

```bash
# 配置公共仓库
npx sksync config set remotes.public.url https://github.com/user/public-skills.git
npx sksync config set remotes.public.enabled true

# 配置私人仓库
npx sksync config set remotes.private.url git@github.com:user/private-skills.git
npx sksync config set remotes.private.enabled true
```

### 执行同步

```bash
# 同步所有仓库
npx sksync sync

# 只同步公共仓库
npx sksync sync --source public

# 只同步私人仓库
npx sksync sync --source private

# 预览变更（不实际执行）
npx sksync sync --dry-run

# 强制覆盖本地
npx sksync sync --force
```

---

## 安全扫描

添加技能时自动扫描敏感信息：

### 检测的敏感信息类型

| 类型 | 模式示例 | 严重级别 |
|------|----------|----------|
| AWS Access Key | `AKIA...` | 高 |
| GitHub Token | `ghp_...`, `gho_...` | 高 |
| 私钥文件 | `-----BEGIN PRIVATE KEY-----` | 高 |
| API Key | `api_key = "..."` | 中 |
| JWT Token | `eyJ...` | 中 |
| 数据库连接 | `mysql://user:pass@...` | 高 |
| Slack Token | `xox...` | 高 |

### 扫描示例

```bash
npx sksync skill add ./config.js --name my-config

# 若检测到敏感信息：
# ⚠️  Sensitive information detected:
#   [HIGH] aws-access-key in config.js:10
#   [MED] api-key-generic in config.js:15
# 
# Continue anyway? (y/N)
```

### 跳过扫描

```bash
# 明确跳过（需二次确认）
npx sksync skill add ./public-config.json --name public-config --skip-scan
```

---

## 配置管理

### 查看配置

```bash
# 列出所有配置
npx sksync config list

# 获取单个配置项
npx sksync config get storage.baseDir
npx sksync config get remotes.public.url
```

### 修改配置

```bash
# 修改存储路径
npx sksync config set storage.baseDir ~/.my-skills

# 启用自动同步
npx sksync config set sync.autoSync true

# 配置同步间隔（分钟）
npx sksync config set sync.syncInterval 30

# 添加扫描跳过规则
npx sksync config set scanner.skipPatterns '["*.md", "docs/**", "test/**"]'
```

### 配置文件示例

配置文件位于 `~/.qcli/config.json`：

```json
{
  "version": "1.0.0",
  "initialized": true,
  "storage": {
    "baseDir": "~/.qcli/data",
    "skillsDir": "skills",
    "knowledgeDir": "knowledge",
    "agentsDir": "agents"
  },
  "remotes": {
    "public": {
      "url": "https://github.com/user/public-skills.git",
      "branch": "main",
      "enabled": true
    }
  },
  "environments": {
    "enabled": ["claude", "cursor", "qwen", "codex", "codebuddy", "common"],
    "default": "common"
  },
  "sync": {
    "autoSync": false,
    "syncInterval": 0,
    "confirmBeforeSync": true
  },
  "scanner": {
    "enabled": true,
    "skipPatterns": ["*.md", "docs/**"]
  },
  "security": {
    "scanBeforePush": true,
    "warnPublicRepo": true
  }
}
```

---

## Git 认证配置

### 方式一：环境变量（推荐）

```bash
# Linux/macOS
export QSKILLS_TOKEN=ghp_your_token_here

# Windows CMD
set QSKILLS_TOKEN=ghp_your_token_here

# Windows PowerShell
$env:QSKILLS_TOKEN="ghp_your_token_here"
```

### 方式二：SSH 密钥

```bash
# 使用 SSH URL
npx sksync config set remotes.private.url git@github.com:user/private-skills.git
```

### 创建 GitHub Token

1. 访问 GitHub → Settings → Developer settings → Personal access tokens
2. 点击 "Generate new token (classic)"
3. 勾选 `repo` 权限
4. 复制 Token 并设置环境变量

---

## 存储结构

```
~/.qcli/
├── config.json              # 配置文件
├── data/
│   ├── index.json           # 本地索引
│   ├── skills/              # 技能存储
│   │   ├── claude/
│   │   │   └── skill-name/
│   │   │       ├── skill.json
│   │   │       └── ...
│   │   ├── cursor/
│   │   ├── qwen/
│   │   ├── codex/
│   │   ├── codebuddy/
│   │   └── common/
│   ├── knowledge/           # 知识库
│   │   ├── claude/
│   │   ├── cursor/
│   │   └── ...
│   └── agents/              # Agent 配置
│       ├── claude/
│       └── ...
├── public-repo/             # 公共仓库克隆
└── private-repo/            # 私人仓库克隆
```

---

## 常见问题

### Q: npx 提示找不到命令？

确保 Node.js 版本 >= 16：
```bash
node -v
```

### Q: 同步失败，提示认证错误？

设置 GitHub Token：
```bash
export QSKILLS_TOKEN=your_token
```

### Q: 如何修改默认存储路径？

```bash
npx sksync config set storage.baseDir ~/custom-path
```

### Q: Windows 路径问题？

使用正斜杠：
```bash
npx sksync skill add "./scripts/tool.js"
```

---

## 开发与测试

```bash
# 克隆仓库
git clone https://github.com/your-username/sksync.git
cd sksync

# 安装依赖
npm install

# 构建
npm run build

# 运行测试
npm test

# 本地运行
node bin/sksync.js --help
```

---

## 相关文档

- [产品需求文档 (PRD)](docs/PRD_sksync_20260409.md)
- [技术规格文档](docs/TECH_SPEC_sksync_20260409.md)
- [测试报告](docs/TEST_REPORT_20260409.md)

---

## 许可证

[MIT](LICENSE)
