# Qcli-Skills 技术方案文档

**文档版本**: v2.0
**创建日期**: 2026/04/09
**更新日期**: 2026/04/09
**产品名称**: Qcli-Skills（简称 `qskills`）

---

## 1. 技术选型

### 1.1 核心技术栈

| 组件 | 选型 | 说明 |
|------|------|------|
| CLI 框架 | Commander.js | 轻量、API 简洁、社区活跃 |
| 交互问答 | @inquirer/prompts | 现代化交互式 CLI |
| Git 操作 | isomorphic-git | 纯 JS 实现，跨平台 |
| 安全扫描 | 内置正则扫描器 | 轻量，可扩展 |
| 配置存储 | JSON 文件 | 简单可靠 |
| Token 存储 | 环境变量 + 可选 keytar | 灵活安全 |
| 测试框架 | Vitest | 快速、ESM 原生支持 |
| 输出美化 | chalk + cli-table3 + ora | 终端输出增强 |

### 1.2 技术选型对比

| 方案 | 优势 | 劣势 | 推荐度 |
|------|------|------|--------|
| **方案 A：轻量级** | 依赖少、包体积小、无系统依赖 | 内置扫描覆盖有限 | 推荐 |
| 方案 B：企业级 | 插件化、功能完善 | 依赖系统环境、包体积大 | 备选 |

**推荐：方案 A（轻量级方案）**

---

## 2. 系统架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLI Layer                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Commander  │───▶│   Handler    │───▶│   Inquirer   │          │
│  │   (解析参数)  │    │   (路由分发)  │    │  (交互问答)   │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ SkillService │    │ KnowledgeSvc │    │ AgentService │          │
│  │ (技能管理)    │    │ (知识库管理)  │    │ (Agent管理)   │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ InstallSvc   │    │  SyncService │    │  EnvService  │          │
│  │ (下载安装)    │    │  (同步控制)   │    │  (环境管理)   │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Core Layer                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Storage    │    │   GitSync    │    │   Scanner    │          │
│  │ (本地存储)    │    │ (Git 操作)   │    │ (安全扫描)    │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ Builtins     │    │   Conflict   │    │   Version    │          │
│  │ (内置库)      │    │  (冲突检测)   │    │  (版本管理)   │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

```
qskills/
├── bin/qskills.js              # CLI 入口
├── src/
│   ├── commands/               # 命令模块
│   │   ├── skill/              # skill 子命令
│   │   ├── knowledge/          # knowledge 子命令
│   │   ├── agent/              # agent 子命令（新增）
│   │   ├── install.ts          # 安装命令（新增）
│   │   ├── download.ts         # 下载命令（新增）
│   │   ├── sync.ts             # 同步命令
│   │   ├── config.ts           # 配置管理
│   │   └── env.ts              # 环境管理（新增）
│   │
│   ├── core/                   # 核心模块
│   │   ├── storage.ts          # 本地存储管理
│   │   ├── git-sync.ts         # Git 同步引擎
│   │   ├── scanner.ts          # 敏感信息扫描
│   │   ├── conflict.ts         # 冲突检测（新增）
│   │   ├── version.ts          # 版本管理（新增）
│   │   ├── builtins.ts         # 内置公共库（新增）
│   │   └── init.ts             # 初始化
│   │
│   ├── types/index.ts          # 类型定义
│   └── utils/                  # 工具函数
│
├── builtins/                   # 内置公共库（新增）
│   ├── skills/
│   ├── knowledge/
│   └── agents/
│
└── package.json
```

---

## 3. 数据模型设计

### 3.1 配置文件结构

```typescript
interface Config {
  version: string;
  initialized: boolean;
  initializedAt?: string;

  storage: {
    baseDir: string;
    skillsDir: string;
    knowledgeDir: string;
    agentsDir: string;  // 新增
  };

  remotes: {
    [name: string]: {
      url: string;
      branch: string;
      enabled: boolean;
      type: 'public' | 'private';
    }
  };

  environments: {
    enabled: AIEnvironment[];
    default: AIEnvironment;
  };

  sync: {
    autoSync: boolean;
    syncInterval: number;
    confirmBeforeSync: boolean;
  };

  scanner: {
    enabled: boolean;
    skipPatterns: string[];
    customPatterns: SecretPattern[];
  };
}
```

### 3.2 Skill/Knowledge 元数据结构

```typescript
interface SkillMeta {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  type: 'single' | 'folder';
  entry: string;
  files?: string[];
  source: 'public' | 'private' | 'builtin';  // 新增 builtin
  environment: AIEnvironment;
  remoteUrl?: string;
  versionHistory?: VersionRecord[];
  checksum: string;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeItem {
  id: string;
  title: string;
  type: 'document' | 'code-snippet' | 'template' | 'note';
  path: string;
  tags: string[];
  category: string;
  source: 'public' | 'private' | 'builtin';
  environment: AIEnvironment;
  version: string;
  checksum: string;
  createdAt: string;
  updatedAt: string;
}
```

### 3.3 Agent 配置包结构（新增）

```typescript
interface AgentConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  environment: AIEnvironment;
  source: 'public' | 'private' | 'builtin';

  // Agent 核心配置
  systemPrompt: string;           // 系统提示词
  tools: AgentTool[];             // 工具配置
  context: AgentContext;          // 上下文配置
  settings: AgentSettings;        // 其他设置

  versionHistory?: VersionRecord[];
  checksum: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentTool {
  name: string;
  description: string;
  type: 'function' | 'resource' | 'prompt';
  config: Record<string, any>;
  enabled: boolean;
}

interface AgentContext {
  maxTokens?: number;
  temperature?: number;
  includePaths?: string[];
  excludePatterns?: string[];
  envVariables?: Record<string, string>;
}
```

### 3.4 本地索引结构

```typescript
interface LocalIndex {
  version: string;
  skills: Record<AIEnvironment, string[]>;
  knowledge: Record<AIEnvironment, string[]>;
  agents: Record<AIEnvironment, string[]>;  // 新增

  lastSync: { [repoName: string]: string | null };
  checksum: { [repoName: string]: string };
  pendingConflicts?: ConflictRecord[];  // 新增
}

interface ConflictRecord {
  resourceId: string;
  resourceType: 'skill' | 'knowledge' | 'agent';
  localVersion: string;
  remoteVersion: string;
  localChecksum: string;
  remoteChecksum: string;
  detectedAt: string;
  status: 'pending' | 'resolved' | 'skipped';
  resolution?: 'local' | 'remote' | 'both';
}
```

### 3.5 AI 环境类型

```typescript
type AIEnvironment = 'claude' | 'cursor' | 'qwen' | 'codex' | 'codebuddy' | 'common';

const AI_ENVIRONMENTS: Record<AIEnvironment, EnvironmentConfig> = {
  claude: { name: 'claude', displayName: 'Claude Code', configDir: '.claude' },
  cursor: { name: 'cursor', displayName: 'Cursor', configDir: '.cursor' },
  qwen: { name: 'qwen', displayName: '通义灵码', configDir: '.qwen' },
  codex: { name: 'codex', displayName: 'OpenAI Codex', configDir: '.codex' },
  codebuddy: { name: 'codebuddy', displayName: 'CodeBuddy Code', configDir: '.codebuddy' },
  common: { name: 'common', displayName: '通用技能', configDir: '' }
};
```

---

## 4. CLI 命令设计

### 4.1 完整命令列表

```bash
qskills [command] [options]

Commands:
  install <name>          安装资源（从内置库或远程仓库）
    --env <env>           目标环境
    --from <source>       来源：builtin/public/private
    --version <ver>       指定版本

  download                从远程仓库下载资源
    --env <env>           指定环境
    --source <repo>       指定仓库
    --all                 下载全部资源
    --force               强制覆盖本地

  sync                    同步资源到远程仓库
    --env <env>           指定环境
    --source <repo>       指定仓库
    --all                 同步全部资源
    --force               强制推送
    --dry-run             预览变更

  skill <action>          技能管理
    add <path> --env <env> --name <name>
    remove <name> --env <env>
    list [--env <env>]
    copy <name> --from <env> --to <env>

  knowledge <action>      知识库管理
    add/remove/list/copy（同 skill）

  agent <action>          Agent 管理（新增）
    add <path> --env <env> --name <name>
    remove <name> --env <env>
    list [--env <env>]
    deploy <name> --env <env>  # 部署 Agent
    copy <name> --from <env> --to <env>

  env <action>            环境管理（新增）
    list                  列出所有环境
    enable/disable <env>  启用/禁用环境

  config <action>         配置管理
    init/set/get/list

  builtins <action>       内置库管理（新增）
    list                  列出内置资源
    install <name>        安装内置资源
```

### 4.2 npx 模式设计

```bash
# 无配置模式 - 只显示内置公共资源
npx qskills list
npx qskills install <name>

# 有配置模式 - 显示仓库 + 内置资源
npx qskills list --repo <url>
npx qskills install <name> --env claude
```

---

## 5. 核心功能实现

### 5.1 内置公共库管理

```typescript
// src/core/builtins.ts

interface BuiltinResource {
  name: string;
  type: 'skill' | 'knowledge' | 'agent';
  description: string;
  tags: string[];
  version: string;
  path: string;
}

class BuiltinManager {
  private resources: Map<string, BuiltinResource>;

  async load(): Promise<void>;
  async list(filter?: { type?: string; tags?: string[] }): Promise<BuiltinResource[]>;
  async get(name: string): Promise<BuiltinResource | null>;
  async install(name: string, targetEnv: AIEnvironment): Promise<void>;
}
```

### 5.2 版本冲突检测

```typescript
// src/core/conflict.ts

interface ConflictResult {
  hasConflict: boolean;
  conflictType: 'version' | 'content' | 'deleted';
  localVersion: string;
  remoteVersion: string;
  suggestions: ConflictSuggestion[];
}

class ConflictManager {
  async detect(
    local: ResourceMeta[],
    remote: ResourceMeta[]
  ): Promise<ConflictRecord[]>;

  async resolve(
    conflict: ConflictRecord,
    resolution: 'local' | 'remote' | 'both'
  ): Promise<void>;

  async promptUser(conflicts: ConflictRecord[]): Promise<void>;
}
```

### 5.3 批量操作

```typescript
// src/core/batch.ts

interface BatchOperation {
  type: 'download' | 'sync' | 'install' | 'delete';
  resources: Array<{
    name: string;
    type: 'skill' | 'knowledge' | 'agent';
    environment?: AIEnvironment;
  }>;
  options: {
    force?: boolean;
    dryRun?: boolean;
    onConflict?: 'prompt' | 'keep-local' | 'keep-remote';
  };
}

interface BatchResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  conflicts: ConflictRecord[];
}

class BatchProcessor {
  async execute(operation: BatchOperation): Promise<BatchResult>;
  async preview(operation: BatchOperation): Promise<PreviewResult>;
}
```

### 5.4 Agent 部署

```typescript
// src/core/agent-deploy.ts

interface AgentDeployer {
  deploy(agent: AgentConfig, environment: AIEnvironment): Promise<void>;
  generateConfig(agent: AgentConfig, environment: AIEnvironment): Promise<string>;
  validate(agent: AgentConfig): ValidationResult;
}

// 各环境配置生成器
const ENV_CONFIG_GENERATORS: Record<AIEnvironment, ConfigGenerator> = {
  claude: new ClaudeConfigGenerator(),
  cursor: new CursorConfigGenerator(),
  qwen: new QwenConfigGenerator(),
  codex: new CodexConfigGenerator(),
  codebuddy: new CodeBuddyConfigGenerator(),
  common: null
};
```

---

## 6. 存储结构设计

### 6.1 本地存储目录结构

```
~/.qcli/
├── config.json                    # 配置文件
├── data/
│   ├── index.json                 # 本地索引
│   ├── skills/                    # 技能存储（按环境分目录）
│   │   ├── claude/
│   │   ├── cursor/
│   │   ├── qwen/
│   │   ├── codex/
│   │   ├── codebuddy/
│   │   └── common/
│   ├── knowledge/                 # 知识库存储（按环境分目录）
│   │   └── ...
│   └── agents/                    # Agent 存储（新增，按环境分目录）
│       └── ...
├── repos/                         # Git 仓库克隆
│   ├── public/
│   └── private/
└── cache/                         # 缓存
```

### 6.2 内置公共库结构

```
builtins/
├── index.json                     # 内置资源索引
├── skills/
│   ├── http-request/
│   ├── file-operations/
│   └── git-helper/
├── knowledge/
│   ├── api-design-guide/
│   └── clean-code-patterns/
└── agents/
    ├── code-reviewer/
    ├── doc-writer/
    └── test-helper/
```

---

## 7. 安全设计

### 7.1 敏感信息扫描规则

```typescript
const DEFAULT_PATTERNS: SecretPattern[] = [
  { name: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/g, severity: 'high' },
  { name: 'github-token', pattern: /ghp_[a-zA-Z0-9]{36}/g, severity: 'high' },
  { name: 'private-key', pattern: /-----BEGIN.*PRIVATE KEY-----/g, severity: 'high' },
  { name: 'api-key-generic', pattern: /(?i)(api[_-]?key)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{20,}/g, severity: 'medium' },
  { name: 'jwt-token', pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*/g, severity: 'medium' },
  { name: 'database-url', pattern: /(mysql|postgres|mongodb):\/\/[^:]+:[^@]+@/g, severity: 'high' }
];
```

### 7.2 Token 管理

- 优先级：环境变量 > 配置文件 > 系统密钥环
- 存储：环境变量 `QSKILLS_TOKEN` 或系统密钥环（keytar）

---

## 8. 错误码定义

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| `AUTH_MISSING` | Token 未配置 | 引导用户配置 Token |
| `AUTH_INVALID` | Token 无效或过期 | 提示重新认证 |
| `NETWORK_OFFLINE` | 网络不可用 | 检查网络连接 |
| `CONFLICT_DETECTED` | 检测到同步冲突 | 用户选择处理策略 |
| `VERSION_DOWNGRADE` | 版本下降警告 | 提示用户确认 |
| `RESOURCE_NOT_FOUND` | 资源不存在 | 检查资源名称 |
| `ENV_NOT_SUPPORTED` | 环境不支持 | 检查环境名称 |

---

## 9. 依赖清单

```json
{
  "dependencies": {
    "commander": "^12.0.0",
    "@inquirer/prompts": "^7.0.0",
    "isomorphic-git": "^1.27.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0",
    "cli-table3": "^0.6.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 10. 风险提示

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Windows 路径兼容性 | 文件操作可能失败 | 使用 path 模块统一处理 |
| Git 认证问题 | 推送失败 | 支持多种认证方式 |
| 敏感信息误报 | 用户困扰 | 提供白名单和跳过选项 |
| 大文件处理 | 性能问题 | 限制单文件大小 |
| 网络不稳定 | 同步失败 | 断点续传 + 重试机制 |

---

## 11. 扩展点预留

### 11.1 插件系统

```typescript
interface IPlugin {
  name: string;
  version: string;
  hooks: {
    'pre-add'?: (context: AddContext) => Promise<void>;
    'post-add'?: (context: AddContext) => Promise<void>;
    'pre-sync'?: (context: SyncContext) => Promise<void>;
    'post-sync'?: (context: SyncContext) => Promise<void>;
  };
}
```

### 11.2 自定义扫描规则

```typescript
interface CustomScanRule {
  name: string;
  pattern: string | RegExp;
  severity: 'high' | 'medium' | 'low';
  description?: string;
}
```

### 11.3 多仓库支持

```typescript
interface RemoteConfig {
  remotes: {
    [name: string]: {
      url: string;
      branch: string;
      enabled: boolean;
      type: 'public' | 'private';
    }
  }
}
```

---

## 12. 边界条件处理

### 12.1 离线场景处理

```typescript
// src/core/network.ts

interface NetworkDetector {
  isOnline(): Promise<boolean>;
  getLastChecked(): Date;
}

// src/core/queue.ts

interface OperationQueue {
  // 待同步操作队列
  pendingOperations: QueuedOperation[];
  
  // 添加操作到队列
  enqueue(operation: SyncOperation): void;
  
  // 处理队列（网络恢复后调用）
  processQueue(): Promise<ProcessResult>;
  
  // 持久化队列到本地
  persist(): Promise<void>;
  
  // 从本地恢复队列
  restore(): Promise<void>;
}

interface QueuedOperation {
  id: string;
  type: 'push' | 'pull' | 'sync';
  resource: string;
  env: AIEnvironment;
  timestamp: string;
  retries: number;
  maxRetries: number;
}
```

### 12.2 版本冲突检测

```typescript
// src/core/conflict.ts

interface ConflictManager {
  // 检测冲突
  detect(
    local: ResourceMeta,
    remote: ResourceMeta
  ): Promise<ConflictResult>;
  
  // 批量检测
  detectBatch(
    resources: Array<{ local?: ResourceMeta; remote: ResourceMeta }>
  ): Promise<ConflictResult[]>;
  
  // 交互式解决（使用 @inquirer/prompts）
  resolveInteractive(conflict: ConflictResult): Promise<Resolution>;
  
  // 自动解决（按策略）
  resolveAuto(
    conflict: ConflictResult,
    strategy: 'keep-local' | 'keep-remote'
  ): Promise<Resolution>;
}

interface ConflictResult {
  hasConflict: boolean;
  conflictType: 'version' | 'content' | 'deleted';
  localVersion: string;
  remoteVersion: string;
  localChecksum: string;
  remoteChecksum: string;
  suggestions: string[];
}

type Resolution = 'keep-local' | 'keep-remote' | 'keep-both' | 'skip';
```

### 12.3 大量资源性能优化

```typescript
// src/core/storage.ts - 分页查询

interface ListOptions {
  env?: AIEnvironment;
  limit?: number;      // 默认 50
  offset?: number;     // 默认 0
  sortBy?: 'name' | 'updatedAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// 大文件阈值
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;  // 10MB

// 资源数量阈值
const RESOURCE_COUNT_THRESHOLD = 500;

// 懒加载实现
class LazyResourceLoader {
  async loadPage(page: number): Promise<ResourcePage>;
  async getTotalCount(): Promise<number>;
}
```

---

## 13. 各 AI 环境配置适配规范

### 13.1 Claude Code

```
配置目录: ~/.claude/
技能存放: ~/.claude/commands/          # Claude Code 自定义命令
Agent配置: ~/.claude/settings.json     # 或 CLAUDE.md

配置格式:
{
  "commands": {
    "my-skill": {
      "description": "技能描述",
      "template": "提示词模板"
    }
  }
}
```

### 13.2 Cursor

```
配置目录: ~/.cursor/
技能存放: ~/.cursorrules               # Cursor 规则文件
Agent配置: ~/.cursor/agents/

配置格式 (.cursorrules):
---
description: 技能描述
globs: ["**/*.ts"]
---
规则内容...
```

### 13.3 通义灵码 (Qwen)

```
配置目录: ~/.qwen/
技能存放: ~/.qwen/skills/
Agent配置: ~/.qwen/agents/

配置格式 (skill.json):
{
  "name": "技能名称",
  "description": "描述",
  "prompt": "提示词模板",
  "context": ["文件路径"]
}
```

### 13.4 CodeBuddy Code

```
配置目录: ~/.codebuddy/
技能存放: ~/.codebuddy/skills/
Agent配置: ~/.codebuddy/agents/

配置格式:
{
  "name": "技能名称",
  "systemPrompt": "系统提示词",
  "tools": [...],
  "context": {...}
}
```

### 13.5 环境适配器接口

```typescript
// src/core/env-adapter.ts

interface EnvAdapter {
  name: AIEnvironment;
  configDir: string;
  
  // 部署技能
  deploySkill(skill: SkillMeta): Promise<void>;
  
  // 部署 Agent
  deployAgent(agent: AgentConfig): Promise<void>;
  
  // 生成配置文件
  generateConfig(resource: ResourceMeta): Promise<string>;
  
  // 验证部署
  verify(name: string): Promise<boolean>;
}

class ClaudeAdapter implements EnvAdapter {
  name = 'claude';
  configDir = '.claude';
  
  async deploySkill(skill: SkillMeta): Promise<void> {
    // 生成 .claude/commands/{skill-name}.md
  }
  
  async deployAgent(agent: AgentConfig): Promise<void> {
    // 更新 settings.json 或生成 CLAUDE.md
  }
}
```

---

## 14. 性能测试策略

### 14.1 性能指标

| 指标 | 目标值 | 测试方法 |
|------|--------|----------|
| 启动时间 | ≤ 2 秒 | 测量 CLI 入口到就绪时间 |
| 列表响应 | ≤ 1 秒（500 资源） | 使用 mock 数据测试 |
| 内存占用 | ≤ 100 MB | 使用 process.memoryUsage() |
| 同步速度 | ≥ 100KB/s | 网络带宽测试 |

### 14.2 测试用例

```typescript
// tests/performance/speed.test.ts

describe('Performance Tests', () => {
  it('should start within 2 seconds', async () => {
    const start = Date.now();
    await import('../src/index.js');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
  
  it('should list 500 resources within 1 second', async () => {
    // 创建 500 个 mock 资源
    // 测量 listSkills() 执行时间
  });
});
```
