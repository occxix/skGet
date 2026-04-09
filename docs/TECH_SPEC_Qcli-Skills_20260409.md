# skget 同步功能 - 技术方案文档

**文档版本**: v3.0
**创建日期**: 2026/04/09
**产品名称**: skget（简称 `skget`）
**本版本聚焦**: 同步功能重构

---

## 1. 架构方案

### 方案对比

| 维度 | 方案 A：data 目录即 Git 仓库 | 方案 B：独立同步目录双向同步 |
|------|------|------|
| 实现 | `~/.qcli/data/` 包含 `.git/` | clone 到 `.sync-repo/`，双向拷贝 |
| 复杂度 | 低 | 高（需维护文件映射、增删改检测） |
| 数据一致性 | 天然一致 | 需额外保证同步完整性 |
| 冲突来源 | 仅 Git 级别 | Git 冲突 + 映射冲突（删了但 repo 还在） |
| 对现有代码侵入 | 只需过滤 `.git/` 目录 | 需改造 Storage 列表方法 |
| 离线操作 | Git 原生支持 | 离线 commit 后仍需两步同步 |

### 推荐：方案 A

1. 用户决策了单一仓库，方案 A 天然满足
2. 当前 `skill/sync.ts` 的 bug 正是方案 B 导致的（同步断路）
3. 对 Storage 类侵入最小
4. isomorphic-git 支持 init + addRemote + fetch 到已有文件目录

### 目标存储结构

```
~/.qcli/
├── config.json              # 配置文件（不纳入 Git）
├── data/                    # Git 仓库根目录
│   ├── .git/                # Git 仓库元数据
│   ├── .gitignore           # 排除临时文件
│   ├── .gitattributes       # 统一换行符
│   ├── index.json           # 本地索引（纳入 Git）
│   ├── skills/              # 技能（按环境分目录）
│   │   ├── claude/
│   │   ├── cursor/
│   │   └── ...
│   ├── knowledge/           # 知识库
│   └── agents/              # Agent 配置
```

---

## 2. 数据模型变更

### 2.1 Config 类型

```typescript
interface Config {
  version: string;
  initialized: boolean;
  initializedAt?: string;
  storage: {
    baseDir: string;
    skillsDir: string;
    knowledgeDir: string;
    agentsDir: string;
  };
  // 新增：单一远程仓库
  remote?: {
    url: string;
    branch: string;      // 默认 'main'
  };
  // 旧字段保留用于向后兼容迁移
  remotes?: {
    public?: RemoteConfig;
    private?: RemoteConfig;
  };
  envRemotes?: Partial<Record<AIEnvironment, RemoteConfig>>;
  // ... 其余字段不变
}
```

### 2.2 同步结果类型

```typescript
interface SyncResult {
  success: boolean;
  action: 'push' | 'pull' | 'sync' | 'status';
  environments?: string[];
  summary: {
    filesAdded: number;
    filesModified: number;
    filesDeleted: number;
    conflictsCount: number;
  };
  conflicts?: ConflictInfo[];
  errors: SyncError[];
  commitSha?: string;
  syncedAt: string;
}

interface SyncError {
  code: string;           // 'REMOTE_NOT_CONFIGURED' | 'NETWORK_ERROR' | 'PUSH_REJECTED' | 'AUTH_FAILED'
  message: string;
  file?: string;
}

interface ConflictInfo {
  file: string;                    // 相对 data/ 的路径
  resourceType: 'skill' | 'knowledge' | 'agent' | 'index' | 'unknown';
  environment?: AIEnvironment;     // 从 file 路径推导
  type: 'both-modified' | 'delete-modify' | 'modify-delete' | 'add-add';
  localChecksum: string;
  remoteChecksum: string;
  localModifiedAt: string;
  remoteModifiedAt: string;
  localSize: number;
  remoteSize: number;
  localExists: boolean;
  remoteExists: boolean;
}

interface SyncStatus {
  remoteConfigured: boolean;
  remoteUrl?: string;
  branch?: string;
  isGitRepo: boolean;
  connected: boolean;
  ahead: number;
  behind: number;
  modified: string[];
  untracked: string[];
  lastSync: string | null;
}

interface ConflictResolution {
  file: string;
  resolution: 'keep-local' | 'keep-remote' | 'skip';
}
```

---

## 3. 模块设计

### 3.1 SyncService

```typescript
// src/core/sync-service.ts

class SyncService {
  constructor(
    private gitSync: GitSync,
    private storage: Storage,
    private scanner: SecurityScanner
  ) {}

  // 初始化 Git 仓库
  async ensureRepo(remote: { url: string; branch: string }): Promise<void>;
  // 流程：检查 .git → git init → addRemote → addAll → commit → push

  // Push
  async push(options: SyncOptions): Promise<SyncResult>;
  // 流程：安全扫描 → commit → push → 返回结果

  // Pull
  async pull(options: SyncOptions): Promise<SyncResult>;
  // 流程：fetch → 检测冲突 → merge(ff) → 返回结果

  // 双向 Sync
  async sync(options: SyncOptions): Promise<SyncResult>;
  // 流程：pull → 有冲突则返回 → 无冲突则 push

  // 状态查询
  async status(): Promise<SyncStatus>;

  // 冲突解决（P1）
  async resolve(resolutions: ConflictResolution[]): Promise<SyncResult>;

  // 预览（P1）
  async preview(options: SyncOptions): Promise<SyncResult>;
}

interface SyncOptions {
  environments?: AIEnvironment[];
  json: boolean;
  dryRun: boolean;
  force: boolean;
  strategy?: 'local-first' | 'remote-first';
}

function getSyncService(): Promise<SyncService>;
```

**与现有 GitSync 的关系**：组合模式，SyncService 持有 GitSync 实例，负责业务编排。

### 3.2 GitSync 增强

```typescript
// src/core/git-sync.ts — 在现有基础上新增

class GitSync {
  // === 现有方法保持不变 ===
  async clone(): Promise<void>;
  async pull(): Promise<SyncResult>;
  async push(): Promise<SyncResult>;
  async commit(message: string): Promise<string | null>;
  async getStatus(): Promise<RepoStatus>;
  async fetch(remoteName?: string): Promise<void>;
  async addRemotes(remotes: { name: string; url: string }[]): Promise<void>;

  // === 新增方法 ===

  // 获取当前 HEAD commit SHA
  async getCurrentCommit(): Promise<string | null>;

  // 获取远程 tracking branch SHA
  async getRemoteCommit(): Promise<string | null>;

  // 精确 ahead/behind 计数
  async getAheadBehind(remoteRef?: string): Promise<{ ahead: number; behind: number }>;

  // 合并远程变更
  async merge(options?: { fastForward?: boolean }): Promise<{
    success: boolean;
    mergeConflicts: string[];
  }>;

  // 解决合并冲突
  async resolveMergeConflict(filepath: string, strategy: 'ours' | 'theirs'): Promise<void>;

  // 读取文件内容（用于 diff 对比）
  async readFile(filepath: string, ref?: string): Promise<Uint8Array | null>;

  // 读取文件最后修改时间
  async getFileModifiedTime(file: string): Promise<string>;

  // 读取文件 checksum
  async getFileChecksum(file: string): Promise<string>;
}
```

### 3.3 Storage 适配

```typescript
// src/core/storage.ts — 最小改动

// listFiles() 和 listDirectories() 中过滤 .git 目录
async listFiles(dir: string, pattern?: RegExp): Promise<string[]> {
  // ... 现有逻辑
  // 新增：过滤 .git 目录
  files = files.filter(f => !f.includes('.git'));
  return files;
}
```

---

## 4. CLI 命令设计

### Commander 注册

```typescript
// src/commands/sync.ts — 重写

program
  .command('sync')
  .description('Sync with remote repository')
  .argument('[action]', 'sync action: push | pull | status | resolve')
  .option('-e, --env <envs...>', 'sync specific environments')
  .option('--all', 'sync all environments (default)')
  .option('--pull', 'pull from remote only')
  .option('--full', 'bidirectional sync (default behavior)')
  .option('--status', 'show sync status')
  .option('--json', 'output as JSON')
  .option('--dry-run', 'preview changes')
  .option('--force', 'force overwrite')
  .option('--resolution <json>', 'conflict resolution JSON (use with resolve action)')
  .action(syncHandler);
```

### 命令路由

```typescript
async function syncHandler(action: string | undefined, options: SyncCliOptions) {
  const service = await getSyncService();

  // 子命令路由
  if (action === 'push' || options.pull === false && options.status === false) {
    return service.push(mapOptions(options));
  }
  if (action === 'pull' || options.pull) {
    return service.pull(mapOptions(options));
  }
  if (action === 'status' || options.status) {
    return outputResult(await service.status(), options.json);
  }
  if (action === 'resolve') {
    const resolutions = JSON.parse(options.resolution);
    return service.resolve(resolutions);
  }

  // 默认：双向 sync
  return service.sync(mapOptions(options));
}
```

---

## 5. 核心流程

### 5.1 初始化流程

```
skget sync（首次）
│
├─ 1. 检查 data/.git 是否存在
│   ├─ 不存在 → git.init({ dir: dataDir, defaultBranch: 'main' })
│   └─ 存在 → 跳过
│
├─ 2. 检查 remote 'origin' 是否存在
│   ├─ 不存在 → git.addRemote({ name: 'origin', url })
│   └─ 存在 → 跳过
│
├─ 3. 创建 .gitignore + .gitattributes
│   ├─ .gitignore: *.tmp, *.log, .DS_Store, Thumbs.db
│   └─ .gitattributes: * text=auto eol=lf
│
├─ 4. git.add + commit（初始提交）
│
├─ 5. git.push 到远程
│
└─ 6. 更新 config.remote
```

### 5.2 Push 流程

```
skget sync push
│
├─ 1. ensureRepo()
├─ 2. getStatus() → 无变更？ → 返回 filesChanged=0
├─ 3. 安全扫描（若启用）→ 发现 secrets？ → 报错退出
├─ 4. git.commit('sync: push {timestamp}')
├─ 5. git.push()
│   ├─ 成功 → 返回 SyncResult
│   └─ 失败（远程有新提交）→ 返回 PUSH_REJECTED 错误
└─ 6. 更新 lastSyncAt
```

### 5.3 Pull 流程

```
skget sync pull
│
├─ 1. ensureRepo()
├─ 2. git.fetch('origin')
│   └─ 网络失败 → 返回 NETWORK_ERROR
├─ 3. getAheadBehind() → behind === 0？ → 返回 "Already up to date"
├─ 4. 检查本地未提交修改
│   └─ 有修改 + 非 force → 检测冲突
├─ 5. git.merge({ fastForward: true })
│   ├─ ff 成功 → 重建 index.json → 返回结果
│   └─ 需要 merge → git.merge({ fastForward: false })
│       ├─ 无冲突 → 返回结果
│       └─ 有冲突 → 收集 ConflictInfo[] → 返回（不自动 push）
└─ 6. 输出结果
```

### 5.4 Sync 流程

```
skget sync（默认）
│
├─ 1. 执行 pull
├─ 2. pull 有冲突？ → 返回冲突结果，不 push
├─ 3. pull 成功 → 执行 push
├─ 4. push 被拒？ → 返回 SYNC_FAILED
└─ 5. 返回合并结果
```

### 5.5 环境过滤实现

```typescript
// push 时只 add 指定环境的目录
const envDirs = options.environments || ALL_ENVIRONMENTS;
const pathsToAdd = ['index.json']; // 始终 add 索引

for (const env of envDirs) {
  pathsToAdd.push(`skills/${env}`);
  pathsToAdd.push(`knowledge/${env}`);
  pathsToAdd.push(`agents/${env}`);
}

for (const path of pathsToAdd) {
  await git.add({ dir: dataDir, filepath: path });
}
```

---

## 6. 配置迁移

```typescript
// src/core/migration.ts

export async function migrateConfig(config: Config): Promise<Config> {
  if (config.remote) return config; // 已迁移

  const repo = config.remotes?.private || config.remotes?.public;
  if (repo?.url) {
    config.remote = {
      url: repo.url,
      branch: repo.branch || 'main'
    };
  }

  return config;
}
```

---

## 7. 文件变更清单

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/core/sync-service.ts` | 同步服务主逻辑（编排层） |
| `src/core/conflict-detector.ts` | 冲突检测器 |
| `src/core/migration.ts` | 配置迁移 |
| `src/core/sync.test.ts` | 同步功能单元测试 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/types/index.ts` | Config 新增 `remote` 字段；新增 SyncResult/SyncStatus/ConflictInfo 等类型 |
| `src/core/git-sync.ts` | 新增 getCurrentCommit/getRemoteCommit/getAheadBehind/merge/resolveMergeConflict 等方法 |
| `src/commands/sync.ts` | 完全重写：子命令路由 + SyncService 调用 |
| `src/core/storage.ts` | listFiles/listDirectories 过滤 `.git/` 目录 |
| `src/core/init.ts` | config init 新增 `--repo` 选项 |
| `src/commands/config.ts` | config init 注册 `--repo` 选项 |
| `src/index.ts` | 确保新 sync 命令注册正确 |

### 删除文件

| 文件 | 原因 |
|------|------|
| `src/commands/skill/sync.ts` | 同步逻辑统一收归 `skget sync` |

---

## 8. 风险评估

### isomorphic-git 限制

| 风险 | 缓解 |
|------|------|
| 不支持完整 merge 冲突标记（`<<<<<<<`） | 用 fetch + readFile 对比代替 merge；冲突时停止并报告 |
| 不支持 SSH 协议 | 只用 HTTPS URL |
| 大文件性能差（内存处理） | .gitignore 排除大文件；data 目录主要是文本文件 |
| push 被拒不像原生 Git 友好提示 | push 前 fetch + getAheadBehind 主动检测 |
| partial clone 不支持 | 用 shallow clone（depth: 1）初始化 |

### Windows 兼容性

| 风险 | 缓解 |
|------|------|
| 路径分隔符 `\` vs `/` | path.join() + Git 路径统一 `/` |
| 换行符 CRLF vs LF | .gitattributes: `* text=auto eol=lf` |
| 文件权限（无 execute bit） | isomorphic-git 忽略 filemode 差异 |

### 断网/超时

| 场景 | 处理 |
|------|------|
| clone 断网 | 返回 NETWORK_ERROR |
| push 断网 | 本地 commit 已完成，下次重试 |
| pull 断网 | 本地数据不受影响 |
| 认证失败 | 返回 AUTH_FAILED + 提示配置凭据 |

### 数据安全

- isomorphic-git 完全本地运行，不发送数据到第三方
- push 前复用 scanner.ts 扫描 secrets
- .gitignore 排除临时文件和 IDE 配置

---

## 9. .gitignore / .gitattributes

```gitignore
# ~/.qcli/data/.gitignore
*.tmp
*.log
*.bak
.DS_Store
Thumbs.db
.vscode/
.idea/
```

```gitattributes
# ~/.qcli/data/.gitattributes
* text=auto eol=lf
```

---

## 10. 实现优先级

| 阶段 | 内容 | 涉及文件 |
|------|------|----------|
| P0-1 | Config 类型变更 + 迁移 | `types/index.ts`, `core/migration.ts` |
| P0-2 | GitSync 增强 | `core/git-sync.ts` |
| P0-3 | SyncService + push/pull | `core/sync-service.ts` |
| P0-4 | CLI 命令重写 | `commands/sync.ts` |
| P0-5 | status + --json 输出 | `commands/sync.ts` |
| P1-1 | 冲突检测器 + resolve | `core/conflict-detector.ts` |
| P1-2 | config init --repo | `core/init.ts`, `commands/config.ts` |
| P1-3 | --dry-run | `commands/sync.ts` |
| P1-4 | 单元测试 | `core/sync.test.ts` |
