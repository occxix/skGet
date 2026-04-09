# sksync - AI 技能管理工具

## 概述

sksync 是一款面向个人开发者的 CLI 技能管理工具，支持多 AI 编程助手的技能、知识库、Agent 配置的统一管理与多源同步。

## 核心能力

### 多环境支持
- **claude** - Claude Code (Anthropic)
- **cursor** - Cursor AI 编辑器
- **qwen** - 通义灵码 (阿里云)
- **codex** - OpenAI Codex
- **codebuddy** - CodeBuddy Code (腾讯)
- **common** - 跨环境通用资源

### 资源管理
- 技能脚本管理 (add/list/remove/copy)
- 知识库管理 (document/code-snippet/template/note)
- Agent 配置管理
- Git 单仓库同步 (push/pull/sync/status/resolve)

## 安装与初始化

```bash
# 非交互式初始化（推荐 AI 使用）
npx sksync config init --defaults

# 自定义配置初始化（含远程仓库）
npx sksync config init --baseDir "~/.qcli" --repo "https://github.com/user/skills"

# 交互式初始化
npx sksync config init

# 全局安装
npm install -g sksync
```

## 常用命令

### 技能管理 (skill / s)

```bash
# 添加单文件技能
npx sksync s add ./my-skill.js -n my-skill -e claude

# 添加文件夹技能
npx sksync s add ./skills/code-review -n code-review --type folder -e claude

# 添加技能到所有环境
npx sksync s add ./skills/sksync -n sksync --type folder --all

# 列出所有技能
npx sksync s list
npx sksync s ls --env cursor

# 删除技能
npx sksync s remove skill-name

# 复制技能到其他环境
npx sksync s copy skill-name --from claude --to cursor

# 查看可用环境
npx sksync s envs
```

### 知识库管理 (knowledge / k)

```bash
# 添加知识条目
npx sksync k add ./doc.md -t "标题" --type document -c 分类名

# 列出知识
npx sksync k list
npx sksync k ls --type document

# 删除知识
npx sksync k remove <id>
```

### Agent 管理 (agent / a)

```bash
# 添加 Agent 配置
npx sksync a add ./agent-config/ -n agent-name -e claude

# 列出 Agent
npx sksync a list

# 删除 Agent
npx sksync a remove agent-name
```

### 配置管理 (config)

```bash
# 非交互式初始化
npx sksync config init --defaults

# 自定义初始化（含远程仓库）
npx sksync config init --baseDir "~/.qcli" --repo "https://github.com/user/repo"

# 查看配置
npx sksync config list
npx sksync config get storage.baseDir

# 修改配置
npx sksync config set storage.baseDir "~/.qcli-new"
```

### 同步功能 (sync)

```bash
# 双向同步（先拉取再推送）
npx sksync sync

# 仅推送到远程
npx sksync sync --push

# 仅从远程拉取
npx sksync sync --pull

# 查看同步状态
npx sksync sync --status

# 同步指定环境
npx sksync sync --env claude,cursor

# JSON 输出（AI 友好）
npx sksync sync --json

# 预览变更（不实际执行）
npx sksync sync --dry-run

# 强制使用远程版本解决冲突
npx sksync sync --force

# 指定冲突策略
npx sksync sync --strategy remote-first
```

## 配置文件

配置文件位于 `~/.qcli/config.json`

### 基础配置

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
  "environments": {
    "enabled": ["claude", "cursor", "qwen", "codex", "codebuddy", "common"],
    "default": "common"
  }
}
```

### 远程仓库配置

单一仓库架构，所有环境共享同一个远程 Git 仓库：

```bash
# 初始化时配置远程仓库
npx sksync config init --repo "https://github.com/user/sksync-data"

# 或通过 config set 配置
npx sksync config set remote.url "https://github.com/user/sksync-data"
npx sksync config set remote.branch "main"
```

配置 Token 认证（推送/拉取私有仓库需要）：

```bash
export SKSYNC_TOKEN="ghp_xxxxxxxxxxxx"
```

> 旧版 `remotes.public` / `remotes.private` 配置会自动迁移为 `remote`，无需手动修改。

## 存储结构

```
~/.qcli/
├── config.json              # 配置文件
├── data/
│   ├── index.json           # 本地索引
│   ├── skills/              # 技能存储
│   │   ├── claude/          # Claude 环境技能
│   │   ├── cursor/          # Cursor 环境技能
│   │   ├── qwen/            # 通义灵码环境技能
│   │   ├── codex/           # Codex 环境技能
│   │   ├── codebuddy/       # CodeBuddy 环境技能
│   │   └── common/          # 通用技能
│   ├── knowledge/           # 知识库
│   └── agents/              # Agent 配置
└── （data/ 目录即 Git 仓库，由 isomorphic-git 管理）
```

## 安全特性

- 自动扫描敏感信息（API Key、Token、私钥等）
- 支持跳过扫描（--skip-scan）
- 推送前安全检查
- 同步冲突自动检测与 JSON 详情输出

## 使用场景

1. **多设备同步** - 在不同设备间同步技能和知识库
2. **多工具管理** - 统一管理多个 AI 编程助手的配置
3. **技能共享** - 通过 Git 仓库共享公共技能
4. **知识积累** - 构建个人知识库，方便查阅和复用

## 相关链接

- GitHub: https://github.com/hlrlive/sksync
- npm: https://www.npmjs.com/package/sksync
