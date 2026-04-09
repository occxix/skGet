# Qcli-Skills 技术方案文档

**文档版本**: v1.0
**创建日期**: 2026/04/09
**产品名称**: Qcli-Skills（简称 `qskills`）

---

## 1. 技术选型

### 1.1 CLI 框架选择

| 框架 | 优势 | 劣势 | 适用场景 |
|------|------|------|----------|
| **Commander.js** | 轻量、API 简洁、社区活跃、文档完善 | 子命令管理稍显繁琐 | 中小型 CLI 工具 |
| **Yargs** | 参数解析强大、生态丰富 | 配置稍复杂 | 需要复杂参数处理的工具 |
| **Oclif** | 企业级、插件化架构 | 较重 | 大型可扩展 CLI |

**推荐：Commander.js + @inquirer/prompts**

理由：
- 作为个人开发者自用工具，Commander.js 足够轻量且功能完备
- 可通过 `@inquirer/prompts` 补充交互式问答能力
- 学习成本低，开发效率高

### 1.2 Git 操作库选择

| 库 | 优势 | 劣势 |
|---|---|---|
| **isomorphic-git** | 纯 JavaScript 实现、无原生依赖、跨平台 | 部分高级功能不如 git 命令完整 |
| **simple-git** | 封装原生 git 命令、功能完整 | 依赖系统安装 git |

**推荐：isomorphic-git**

理由：
- 纯 JavaScript 实现，无需依赖系统 git 安装
- 跨平台兼容性好（Windows/Linux/macOS）
- 对于 clone/push/pull/commit 等核心操作完全满足需求

### 1.3 敏感信息检测方案

| 方案 | 说明 |
|------|------|
| **detect-secrets (IBM)** | Python 工具，可作为子进程调用 |
| **gitleaks** | Go 编写，速度快，可作为二进制依赖 |
| **自定义正则扫描** | 轻量，但覆盖面有限 |

**推荐：内置轻量扫描器 + 可选外部工具集成**

```javascript
// 内置扫描规则示例
const SECRET_PATTERNS = [
  { name: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'github-token', pattern: /ghp_[a-zA-Z0-9]{36}/g },
  { name: 'private-key', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
  { name: 'api-key-generic', pattern: /(?i)(api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{20,}/g },
];
```

---

## 2. 系统架构设计

### 2.1 模块划分

```
skill-manager/
├── bin/                    # CLI 入口
│   └── skill-manager.js
├── src/
│   ├── commands/           # 命令模块
│   │   ├── skill/          # skill 子命令
│   │   │   ├── add.js
│   │   │   ├── remove.js
│   │   │   ├── list.js
│   │   │   ├── sync.js
│   │   │   └── search.js
│   │   ├── knowledge/      # knowledge 子命令
│   │   │   ├── add.js
│   │   │   ├── remove.js
│   │   │   ├── list.js
│   │   │   └── search.js
│   │   ├── config.js       # 配置管理
│   │   └── sync.js         # 全局同步
│   │
│   ├── core/               # 核心模块
│   │   ├── storage.js      # 本地存储管理
│   │   ├── git-sync.js     # Git 同步引擎
│   │   ├── scanner.js      # 敏感信息扫描
│   │   ├── auth.js         # 认证管理
│   │   ├── lock.js         # 并发控制
│   │   └── network.js      # 网络状态检测
│   │
│   ├── models/             # 数据模型
│   │   ├── skill.js
│   │   ├── knowledge.js
│   │   └── config.js
│   │
│   ├── utils/              # 工具函数
│   │   ├── file.js         # 文件操作
│   │   ├── prompt.js       # 交互式问答封装
│   │   ├── logger.js       # 日志输出
│   │   └── validator.js    # 数据校验
│   │
│   └── index.js            # 主入口
│
├── templates/              # 模板文件
├── config/                 # 默认配置
└── package.json
```

### 2.2 核心数据流

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
│  │ SkillService │    │ KnowledgeSvc │    │  SyncService │          │
│  │ (技能管理)    │    │ (知识库管理)  │    │  (同步控制)   │          │
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
│  │     Auth     │    │     Lock     │    │   Network    │          │
│  │  (认证管理)   │    │  (并发控制)   │    │  (网络检测)   │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        External Resources                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  Public Repo │    │ Private Repo │    │  Local FS    │          │
│  │ (公共技能库)  │    │ (私人仓库)    │    │ (本地文件)    │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 数据模型设计

### 3.1 配置文件结构 (`~/.qcli/config.json`)

```json
{
  "version": "1.0.0",
  "initialized": true,
  "initializedAt": "2026-04-09T10:00:00Z",
  "storage": {
    "baseDir": "~/.qcli/data",
    "skillsDir": "skills",
    "knowledgeDir": "knowledge"
  },
  "remotes": {
    "public": {
      "url": "https://github.com/username/public-skills.git",
      "branch": "main",
      "enabled": true
    },
    "private": {
      "url": "git@github.com:username/private-skills.git",
      "branch": "main",
      "enabled": true
    }
  },
  "sync": {
    "autoSync": false,
    "syncInterval": 0,
    "confirmBeforeSync": true
  },
  "scanner": {
    "enabled": true,
    "skipPatterns": ["*.md", "docs/**"],
    "customPatterns": []
  },
  "security": {
    "scanBeforePush": true,
    "warnPublicRepo": true
  }
}
```

### 3.2 Skill 元数据结构 (`skill.json`)

```typescript
interface SkillMeta {
  id: string;                    // UUID
  name: string;                  // 技能名称
  version: string;               // 语义化版本
  description: string;           // 描述
  author: string;                // 作者
  tags: string[];                // 标签
  type: 'single' | 'folder';     // 存储类型

  // 文件信息
  entry: string;                 // 入口文件
  files?: string[];              // 文件列表（文件夹类型）

  // 来源信息
  source: 'public' | 'private';  // 来源仓库
  remoteUrl?: string;            // 远程地址

  // 时间戳
  createdAt: string;
  updatedAt: string;

  // 扩展字段
  dependencies?: string[];
  config?: Record<string, any>;
}
```

### 3.3 知识库索引结构 (`knowledge-index.json`)

```typescript
interface KnowledgeItem {
  id: string;
  title: string;
  type: 'document' | 'code-snippet' | 'template' | 'note';
  path: string;
  tags: string[];
  category: string;

  // 元数据
  language?: string;
  framework?: string;

  // 搜索优化
  keywords: string[];
  summary: string;

  // 来源
  source: 'public' | 'private';

  // 时间
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeIndex {
  version: string;
  items: KnowledgeItem[];
  categories: Record<string, string[]>;
  tagIndex: Record<string, string[]>;
}
```

### 3.4 本地仓库索引 (`index.json`)

```typescript
interface LocalIndex {
  version: string;
  skills: {
    public: string[];
    private: string[];
  };
  knowledge: {
    public: string[];
    private: string[];
  };
  lastSync: {
    public: string | null;
    private: string | null;
  };
  checksum: {
    public: string;
    private: string;
  };
}
```

---

## 4. 核心 API/命令设计

### 4.1 CLI 命令列表

```
qskills [command] [options]

Commands:
  skill <action>         技能管理
    add <path>           添加技能
      --name, -n         技能名称
      --type <type>      single|folder
      --source <source>  public|private
      --tags <tags>      标签（逗号分隔）
      --skip-scan        跳过安全扫描（需二次确认）
    remove <name>        移除技能
      --force, -f        强制删除
    list                 列出所有技能
      --source <source>  筛选来源
      --tags <tags>      筛选标签
    search <keyword>     搜索技能
    sync                 同步技能
      --source <source>  指定同步源
      --force            强制覆盖本地

  knowledge <action>     知识库管理
    add <path>           添加知识条目
      --type <type>      document|code-snippet|template|note
      --category <cat>   分类
      --tags <tags>      标签
      --skip-scan        跳过安全扫描
    remove <id>          移除知识条目
    list                 列出知识条目
      --type <type>      筛选类型
      --category <cat>   筛选分类
    search <keyword>     搜索知识条目
    sync                 同步知识库

  config <action>        配置管理
    init                 初始化配置
    set <key> <value>    设置配置项
    get <key>            获取配置项
    list                 列出所有配置

  sync                   全局同步
    --auto               启用自动同步模式
    --dry-run            预览变更
```

### 4.2 关键接口定义

```typescript
// src/core/storage.ts
interface IStorage {
  init(): Promise<void>;
  addSkill(skill: SkillMeta, files: string[]): Promise<void>;
  removeSkill(id: string): Promise<void>;
  getSkill(id: string): Promise<SkillMeta | null>;
  listSkills(filter?: SkillFilter): Promise<SkillMeta[]>;

  addKnowledge(item: KnowledgeItem, content: string): Promise<void>;
  removeKnowledge(id: string): Promise<void>;
  getKnowledge(id: string): Promise<KnowledgeItem | null>;
  listKnowledge(filter?: KnowledgeFilter): Promise<KnowledgeItem[]>;

  updateIndex(): Promise<void>;
  getIndex(): Promise<LocalIndex>;
}

// src/core/git-sync.ts
interface IGitSync {
  initRepo(type: 'public' | 'private'): Promise<void>;
  pull(type: 'public' | 'private'): Promise<SyncResult>;
  push(type: 'public' | 'private'): Promise<SyncResult>;
  sync(type: 'public' | 'private'): Promise<SyncResult>;
  getStatus(type: 'public' | 'private'): Promise<RepoStatus>;
  hasChanges(type: 'public' | 'private'): Promise<boolean>;
}

interface SyncResult {
  success: boolean;
  pulled: number;
  pushed: number;
  conflicts: string[];
  errors: string[];
}

// src/core/scanner.ts
interface IScanner {
  scanFiles(files: string[]): Promise<ScanResult>;
  scanDirectory(dir: string): Promise<ScanResult>;
  addPattern(pattern: SecretPattern): void;
}

interface ScanResult {
  hasSecrets: boolean;
  findings: SecretFinding[];
}

interface SecretFinding {
  file: string;
  line: number;
  type: string;
  match: string;
  severity: 'high' | 'medium' | 'low';
}
```

---

## 5. Git 认证方案设计

### 5.1 认证策略

| 阶段 | 认证方式 | 说明 |
|------|----------|------|
| P0 | HTTPS + Personal Access Token | 优先实现，兼容性最佳 |
| P1 | SSH 密钥支持 | 作为可选扩展 |

### 5.2 Token 存储方案

```typescript
import keytar from 'keytar';

const SERVICE_NAME = 'qskills';
const ACCOUNT_NAME = 'git-token';

// 存储 Token
async function saveToken(token: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
}

// 获取 Token（优先级：密钥环 > 环境变量）
async function getToken(): Promise<string | null> {
  // 1. 优先检查环境变量
  const envToken = process.env.QSKILLS_TOKEN;
  if (envToken) return envToken;

  // 2. 从系统密钥环获取
  return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
}

// 删除 Token
async function deleteToken(): Promise<void> {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}
```

### 5.3 Git 操作认证配置

```typescript
import git from 'isomorphic-git';

async function cloneWithAuth(url: string, dir: string, token: string) {
  return await git.clone({
    fs,
    http,
    dir,
    url,
    onAuth: () => ({
      username: token,
      password: 'x-oauth-basic'
    })
  });
}
```

---

## 6. 并发控制策略

### 6.1 文件锁实现

```typescript
import lockfile from 'proper-lockfile';

const LOCK_OPTIONS = {
  stale: 30000,      // 30s 后锁过期
  retries: 3,        // 重试 3 次
  minTimeout: 100,   // 最小重试间隔 100ms
  maxTimeout: 1000   // 最大重试间隔 1s
};

async function withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const release = await lockfile.lock(filePath, LOCK_OPTIONS);
  try {
    return await fn();
  } finally {
    await release();
  }
}
```

### 6.2 原子写入策略

```typescript
import { rename, writeFile } from 'fs/promises';
import { join, dirname } from 'path';

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = join(dirname(filePath), `.${Date.now()}.tmp`);

  // 1. 先写入临时文件
  await writeFile(tempPath, content, { mode: 0o600 });

  // 2. 原子性 rename
  await rename(tempPath, filePath);
}
```

---

## 7. 网络与离线处理

### 7.1 网络状态检测

```typescript
import isOnline from 'is-online';

interface NetworkStatus {
  isOnline: boolean;
  lastChecked: Date;
}

let cachedStatus: NetworkStatus | null = null;
const CACHE_TTL = 30000; // 30s 缓存

async function checkNetwork(): Promise<boolean> {
  const now = new Date();

  if (cachedStatus && (now.getTime() - cachedStatus.lastChecked.getTime()) < CACHE_TTL) {
    return cachedStatus.isOnline;
  }

  const online = await isOnline({ timeout: 5000 });
  cachedStatus = { isOnline: online, lastChecked: now };
  return online;
}
```

### 7.2 离线操作策略

| 操作类型 | 在线行为 | 离线行为 |
|----------|----------|----------|
| 本地技能列表 | 正常执行 | 正常执行 |
| 本地技能读取 | 正常执行 | 正常执行 |
| 本地技能写入 | 正常执行 | 正常执行（延迟同步） |
| 克隆远程仓库 | 正常执行 | 抛出 `NetworkError` |
| 推送变更 | 正常执行 | 缓存到待推送队列 |
| 拉取更新 | 正常执行 | 跳过，使用本地缓存 |

### 7.3 请求超时与重试

```typescript
const REQUEST_CONFIG = {
  timeout: 30000,      // 30s 超时
  retries: 3,          // 重试 3 次
  retryDelay: 1000,    // 初始重试延迟 1s
  retryMultiplier: 2   // 指数退避倍数
};
```

---

## 8. 安全加固措施

### 8.1 文件权限设置

```typescript
import { chmod, mkdir } from 'fs/promises';
import { platform } from 'os';

const SECURE_DIR_MODE = 0o700;   // rwx------
const SECURE_FILE_MODE = 0o600;  // rw-------

async function initSecureDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true, mode: SECURE_DIR_MODE });

  if (platform() === 'win32') {
    await setWindowsACL(dirPath);
  } else {
    await chmod(dirPath, SECURE_DIR_MODE);
  }
}
```

### 8.2 Windows ACL 实现

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function setWindowsACL(path: string): Promise<void> {
  const commands = [
    `icacls "${path}" /inheritance:d`,
    `icacls "${path}" /grant:r "%USERNAME%:(F)"`,
    `icacls "${path}" /remove "Users" "Everyone"`
  ];

  for (const cmd of commands) {
    await execAsync(cmd);
  }
}
```

---

## 9. 错误码定义

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| `AUTH_MISSING` | Token 未配置 | 引导用户配置 Token |
| `AUTH_INVALID` | Token 无效或过期 | 提示重新认证 |
| `LOCK_TIMEOUT` | 获取文件锁超时 | 稍后重试 |
| `NETWORK_OFFLINE` | 网络不可用 | 检查网络连接 |
| `NETWORK_TIMEOUT` | 请求超时 | 稍后重试 |
| `PERMISSION_DENIED` | 权限设置失败 | 检查系统权限 |
| `CONFIG_NOT_FOUND` | 配置文件不存在 | 执行初始化 |
| `REPO_NOT_FOUND` | 仓库不存在 | 检查仓库地址 |
| `CONFLICT_DETECTED` | 检测到同步冲突 | 用户选择处理策略 |

---

## 10. 依赖清单

### 10.1 核心依赖

```json
{
  "dependencies": {
    "commander": "^12.0.0",
    "@inquirer/prompts": "^7.0.0",
    "isomorphic-git": "^1.27.0",
    "keytar": "^7.9.0",
    "proper-lockfile": "^4.1.2",
    "is-online": "^10.0.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0",
    "conf": "^13.0.0"
  }
}
```

### 10.2 开发依赖

```json
{
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### 10.3 系统依赖说明

`keytar` 需要系统原生依赖，部分 Linux 发行版需要安装：

```bash
# Ubuntu/Debian
sudo apt-get install libsecret-1-0 libsecret-1-dev

# Fedora
sudo dnf install libsecret

# Alpine
apk add libsecret
```

---

## 11. 技术路线对比

### 11.1 路线 A：轻量级方案（推荐）

| 组件 | 选型 |
|------|------|
| CLI 框架 | Commander.js |
| 交互问答 | @inquirer/prompts |
| Git 操作 | isomorphic-git |
| 敏感扫描 | 内置正则扫描器 |
| 配置存储 | JSON 文件 |
| Token 存储 | keytar（系统密钥环） |

**优势**：
- 依赖少、包体积小
- 无需系统安装额外工具
- 开发周期短、维护简单

**风险**：
- 内置扫描器覆盖面有限
- Git 高级操作受限

### 11.2 路线 B：企业级方案

| 组件 | 选型 |
|------|------|
| CLI 框架 | Oclif |
| Git 操作 | simple-git（依赖系统 git） |
| 敏感扫描 | detect-secrets 或 gitleaks |
| 配置存储 | SQLite + JSON |

**优势**：
- 插件化架构，扩展性强
- 检测能力更完善

**风险**：
- 依赖系统环境
- 包体积较大

### 11.3 推荐决策

**推荐：路线 A（轻量级方案）**

理由：需求明确为"个人开发者自用"，路线 A 完全满足需求且开发维护成本更低。

---

## 12. 风险提示

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Windows 路径兼容性 | 文件操作可能失败 | 使用 `path` 模块统一处理 |
| Git 认证问题 | 推送失败 | 支持 Token 多种认证方式，存储到系统密钥环 |
| 敏感信息误报 | 用户困扰 | 提供白名单和跳过选项（需确认） |
| 大文件处理 | 性能问题 | 限制单文件大小，提供分片上传 |
| 网络不稳定 | 同步失败 | 断点续传 + 重试机制 |
| 配置文件损坏 | 数据丢失 | 定期备份，提供修复命令 |

---

---

## 14. npx 发布与执行配置

### 14.1 package.json 完整配置

```javascript
#!/usr/bin/env node

import { program } from '../src/index.js';
import { checkFirstRun } from '../src/core/init.js';

// 首次使用检测
await checkFirstRun();

// 解析命令行参数
program.parse(process.argv);
```

### 14.3 npx 执行方式

#### 方式一：发布到 npm 公共仓库

```bash
# 发布
npm publish

# 用户执行
npx qskills skill list
npx qskills@1.0.0 skill add ./my-skill
```

#### 方式二：GitHub 仓库直接执行（无需发布）

```bash
# 用户直接从 GitHub 执行
npx github:your-username/qskills skill list

# 指定分支/标签
npx github:your-username/qskills#v1.0.0 skill list
npx github:your-username/qskills#main skill add ./my-skill
```

#### 方式三：Git URL 直接执行

```bash
# 使用 Git URL
npx git+https://github.com/your-username/qskills.git skill list

# 使用 SSH
npx git+ssh://git@github.com:your-username/qskills.git skill list
```

#### 方式四：本地开发调试

```bash
# 在项目目录下执行
npx . skill list

# 或链接到全局
npm link
qskills skill list

# 取消链接
npm unlink -g qskills
```

### 14.4 发布流程

#### 发布到 npm

```bash
# 1. 登录 npm
npm login

# 2. 检查将要发布的文件
npm pack --dry-run

# 3. 发布（自动执行 prepublishOnly）
npm publish

# 4. 发布 beta 版本
npm publish --tag beta
```

#### 发布到 GitHub Packages

```json
// package.json 添加
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

```bash
# 发布到 GitHub Packages
npm publish
```

### 14.5 版本管理

```bash
# 补丁版本 (1.0.0 -> 1.0.1)
npm version patch

# 次要版本 (1.0.0 -> 1.1.0)
npm version minor

# 主要版本 (1.0.0 -> 2.0.0)
npm version major

# 预发布版本 (1.0.0 -> 1.0.1-beta.0)
npm version prerelease --preid=beta
```

### 14.6 使用场景对照

| 场景 | 推荐方案 | 命令示例 |
|------|----------|----------|
| 个人使用（私有） | GitHub 私有仓库 | `npx github:user/qskills skill list` |
| 分享给他人 | npm 公共仓库 | `npx qskills skill list` |
| 团队内部 | npm 私有仓库 / GitHub Packages | `npx @org/qskills skill list` |
| 本地开发调试 | 本地执行 | `npx . skill list` |
| CI/CD 环境 | 指定版本 | `npx qskills@1.0.0 skill sync` |

### 14.7 npx 缓存与更新

```bash
# 清除 npx 缓存，强制使用最新版本
npx qskills@latest skill list

# 查看已安装的包
npx qskills --version

# 指定 registry
npx --registry=https://registry.npmmirror.com qskills skill list
```

### 14.8 安全注意事项

1. **包名保护**：在 npm 上注册包名，防止被抢注
2. **版本锁定**：生产环境建议指定版本号
3. **校验和验证**：发布时生成 SHA256 校验和

```bash
# 生成校验和
shasum -a 256 qskills-1.0.0.tgz > checksums.txt

# 在 README 中提供校验和
```

4. **双因素认证**：npm 账户启用 2FA

```bash
# 启用 2FA
npm profile enable-2fa auth-and-writes
```

---

## 15. 扩展点预留

### 15.1 插件系统

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

### 15.2 自定义扫描规则

```typescript
interface CustomScanRule {
  name: string;
  pattern: string | RegExp;
  severity: 'high' | 'medium' | 'low';
  description?: string;
}
```

### 15.3 多仓库支持

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
