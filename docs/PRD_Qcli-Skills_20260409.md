# qskills 同步功能 - 产品需求文档 (PRD)

**文档版本**: v3.0
**创建日期**: 2026/04/09
**产品名称**: qskills（简称 `qskills`）
**本版本聚焦**: 同步功能重构

---

## 1. 业务目标

将 `~/.qcli/data/` 目录作为单一 Git 仓库，实现技能/知识库/Agent 配置的 push/pull/sync，支持特定环境或全部环境范围同步，冲突时返回 JSON 交由上层 AI 决策。

## 2. 用户故事

### Story 1：开发者日常同步
> **作为** 在多台电脑工作的开发者
> **我希望** 运行 `qskills sync` 即可将所有环境的数据推送到 GitHub
> **以便** 在另一台设备上 `qskills sync --pull` 恢复全部工作环境

### Story 2：AI Agent 调用同步
> **作为** AI 编程助手（如 CodeBuddy Code）
> **我希望** 调用 `qskills sync --json` 后收到结构化 JSON 结果
> **以便** 解析同步状态和冲突信息，自动决定处理策略

### Story 3：按环境同步
> **作为** 只使用 Claude 和 CodeBuddy 的开发者
> **我希望** `qskills sync --env claude,codebuddy` 只同步这两个环境
> **以便** 避免推送不相关环境的数据

### Story 4：冲突检测与解决
> **作为** AI Agent
> **我希望** 同步时若检测到冲突，收到包含本地/远程版本的 JSON 详情
> **以便** 根据 timestamp 或 checksum 决定保留哪个版本，然后通过 `sync resolve` 回传决策

### Story 5：查看同步状态
> **作为** 开发者
> **我希望** 执行 `qskills sync --status` 查看本地与远程的差异
> **以便** 在同步前了解将有哪些变更

## 3. 架构决策

**将 `~/.qcli/data/` 直接作为 Git 仓库（方案 A）**：

```
~/.qcli/data/           ← 就是 Git 仓库
├── .git/               ← Git 元数据（隐藏目录）
├── index.json          ← 索引文件（也被 Git 跟踪）
├── .gitignore          ← 排除临时文件
├── skills/
│   ├── claude/
│   ├── cursor/
│   └── ...
├── knowledge/
└── agents/
```

**选择理由**：
- 实现最简单，push = `git add -A && git commit && git push`
- index.json 被 Git 跟踪，天然支持版本回溯
- 无需文件拷贝，避免竞态条件和脏状态

## 4. 核心同步流程

### 4.1 Push 流程（本地 → 远程）

```
qskills sync
    │
    ├─ 前置检查
    │  ├─ config.remote.url 存在？ → 否：报错
    │  ├─ data/ 是 git repo？ → 否：git init + remote add + 首次 commit
    │  └─ scanner 启用？ → 扫描变更文件
    │     └─ 发现敏感信息 → 报错退出
    │
    ├─ 收集变更（--env 过滤指定环境目录）
    ├─ git add + commit + push
    │
    └─ 输出结果（表格 / JSON）
```

### 4.2 Pull 流程（远程 → 本地）

```
qskills sync --pull
    │
    ├─ 前置检查
    │  └─ data/ 是 git repo？ → 否：git clone remote to data/
    │
    ├─ git fetch origin
    ├─ git merge origin/<branch> (fast-forward)
    │
    ├─ 冲突？
    │  ├─ 无 → 合并成功，重建 index.json
    │  └─ 有 → 收集 ConflictRecord[]
    │     ├─ --json：输出 JSON，不自动解决
    │     └─ 普通模式：输出冲突列表
    │
    └─ 输出结果
```

### 4.3 双向 Sync 流程（默认行为）

```
qskills sync（默认 = --full）
    │
    ├─ 1. 执行 pull 流程
    ├─ 2. 有冲突？ → 返回冲突信息，不继续 push
    ├─ 3. 无冲突 → 执行 push 流程
    └─ 4. 输出合并结果
```

### 4.4 冲突处理流程

```
检测到冲突（同一文件本地和远程都修改）
    │
    ├─ 自动处理（无需介入）
    │  ├─ 本地删除 + 远程修改 → 采用远程版本
    │  └─ 本地修改 + 远程删除 → 保留本地版本
    │
    ├─ 需决策冲突
    │  ├─ --json 模式：输出冲突列表 JSON，sync 暂停不 push
    │  └─ 普通模式：输出冲突列表，提示用户
    │
    └─ AI 决策后回传
       qskills sync resolve --resolution '<json>'
```

## 5. 功能列表

### P0 - MVP（必须实现）

| 编号 | 功能 | 描述 | 验收标准 |
|------|------|------|----------|
| S-P0-01 | 配置远程仓库 | 单一 `remote.url` + `remote.branch` | `config set remote.url` 持久化 |
| S-P0-02 | Push 同步 | 将 data 目录变更推送到远程 | `qskills sync` 成功 push |
| S-P0-03 | Pull 同步 | 从远程拉取更新到本地 data | `qskills sync --pull` 成功 pull |
| S-P0-04 | 双向 Sync | 先 pull 再 push | `qskills sync`（默认行为） |
| S-P0-05 | 环境过滤 | `--env` 指定同步范围 | 只同步指定环境目录 |
| S-P0-06 | 冲突检测 | pull/sync 时检测文件冲突 | 返回结构化冲突列表 |
| S-P0-07 | JSON 输出 | `--json` 返回结构化结果 | AI 可解析的 JSON 格式 |
| S-P0-08 | 初始化仓库 | 首次同步自动 init + remote add | 无需手动 git init |
| S-P0-09 | 安全扫描 | push 前扫描敏感信息 | 检测到敏感信息时中止 |
| S-P0-10 | 状态查询 | 查看本地与远程的差异 | `qskills sync --status` 显示 ahead/behind |

### P1 - 后续迭代

| 编号 | 功能 | 描述 |
|------|------|------|
| S-P1-01 | 冲突解决命令 | `sync resolve` 接受 AI 决策 JSON 完成同步 |
| S-P1-02 | Dry-run 模式 | `--dry-run` 预览同步变更 |
| S-P1-03 | 同步策略 | `--strategy local-first/remote-first` |
| S-P1-04 | 同步历史 | 记录每次同步时间和结果 |

## 6. CLI 命令设计

```bash
# === 核心同步 ===

# 双向同步（默认，先 pull 再 push）
qskills sync
qskills sync --env claude              # 只同步 claude 环境
qskills sync --env claude,cursor       # 同步多个环境

# 单向推送
qskills sync push

# 单向拉取
qskills sync pull
qskills sync pull --env codebuddy

# 查看同步状态
qskills sync --status

# === 输出格式 ===

qskills sync --json                    # JSON 输出（AI 友好）
qskills sync                           # 表格输出（人类友好，默认）

# === 预览与强制 ===

qskills sync --dry-run                 # 预览将要同步的变更
qskills sync --force                   # 强制覆盖（冲突时采用远程版本）

# === 冲突解决（P1）===

# AI 传入冲突决策列表
qskills sync resolve --resolution '[{"file":"skills/claude/review/SKILL.md","resolution":"keep-remote"}]'
```

## 7. 配置简化方案

### 旧方案 → 新方案

| 项目 | 旧设计 | 新设计 |
|------|--------|--------|
| 仓库数量 | 2（public + private） | 1（remote） |
| 配置字段 | `remotes.public` / `remotes.private` | `remote` |
| 初始化参数 | `--public-repo` + `--private-repo` | `--repo` |

### 新配置结构

```json
{
  "remote": {
    "url": "https://github.com/user/qskills-data.git",
    "branch": "main"
  }
}
```

CLI 配置方式：

```bash
# 初始化时配置
npx qskills config init --repo "https://github.com/user/qskills-data.git"

# 后续修改
npx qskills config set remote.url "https://github.com/user/qskills-data.git"
npx qskills config set remote.branch "main"
```

### 向后兼容

若旧配置存在 `remotes.public/private`，启动时自动迁移到 `remote`（优先 private）。

## 8. JSON 输出规范

### 成功响应（push）

```json
{
  "success": true,
  "action": "push",
  "environments": ["claude", "cursor", "common"],
  "summary": {
    "filesAdded": 2,
    "filesModified": 3,
    "filesDeleted": 1,
    "conflictsCount": 0
  },
  "commitSha": "abc1234",
  "syncedAt": "2026-04-09T12:00:00Z"
}
```

### 冲突响应（pull/sync）

```json
{
  "success": false,
  "action": "sync",
  "summary": {
    "filesAdded": 5,
    "filesModified": 2,
    "filesDeleted": 0,
    "conflictsCount": 1
  },
  "conflicts": [
    {
      "file": "skills/claude/code-review/SKILL.md",
      "resourceType": "skill",
      "environment": "claude",
      "type": "both-modified",
      "localChecksum": "abc123",
      "remoteChecksum": "def456",
      "localModifiedAt": "2026-04-09T10:00:00Z",
      "remoteModifiedAt": "2026-04-09T11:00:00Z",
      "localSize": 1024,
      "remoteSize": 1089
    }
  ],
  "resolutionHint": "Use: qskills sync resolve --resolution '<json>'",
  "syncedAt": "2026-04-09T12:00:00Z"
}
```

### 状态响应

```json
{
  "success": true,
  "remoteConfigured": true,
  "remoteUrl": "https://github.com/user/qskills-data.git",
  "branch": "main",
  "ahead": 3,
  "behind": 1,
  "modified": ["skills/claude/review/SKILL.md"],
  "untracked": ["knowledge/common/new-doc.md"],
  "lastSync": "2026-04-08T10:00:00Z"
}
```

### 错误响应

```json
{
  "success": false,
  "errors": [
    {
      "code": "REMOTE_NOT_CONFIGURED",
      "message": "No remote configured. Run: qskills config set remote.url <url>"
    }
  ]
}
```

## 9. 边界场景

| 场景 | 处理方式 |
|------|----------|
| 未配置远程仓库 | 报错 `REMOTE_NOT_CONFIGURED`，提示配置命令 |
| 远程仓库不存在 | 自动 git init + remote add + 首次 push 创建 |
| 网络断开 | 报错 `NETWORK_ERROR`，JSON 返回错误信息 |
| data 目录无变更 | 输出 "Already up to date"，filesChanged=0 |
| 敏感信息检测 | 中止 push，返回扫描结果 |
| 远程有新提交（push 被拒） | 提示先 pull，返回 `PUSH_REJECTED` 错误 |
| 远程已有数据本地为空 | pull 时自动合并到本地 |
| 本地有数据远程为空 | push 时自动创建远程结构 |
| data 目录已含 .git | 跳过 init，直接使用现有仓库 |

## 10. 冲突类型定义

| 类型 | 说明 | 默认处理 |
|------|------|----------|
| `both-modified` | 本地和远程都修改了同一文件 | 需 AI 决策 |
| `delete-modify` | 本地删除 + 远程修改 | 自动采用远程 |
| `modify-delete` | 本地修改 + 远程删除 | 自动保留本地 |
| `add-add` | 双方都新增同名文件 | 需 AI 决策 |
