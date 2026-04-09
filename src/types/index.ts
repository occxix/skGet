// 数据模型定义

// 支持的 AI 编程助手环境
export type AIEnvironment = 'claude' | 'cursor' | 'qwen' | 'codex' | 'codebuddy' | 'common';

// 环境配置信息
export interface EnvironmentConfig {
  name: string;
  displayName: string;
  configDir: string;        // 配置目录名，如 .claude
  description: string;
  enabled: boolean;
}

// 环境预设配置
export const AI_ENVIRONMENTS: Record<AIEnvironment, EnvironmentConfig> = {
  claude: {
    name: 'claude',
    displayName: 'Claude Code',
    configDir: '.claude',
    description: 'Anthropic Claude Code 助手',
    enabled: true
  },
  cursor: {
    name: 'cursor',
    displayName: 'Cursor',
    configDir: '.cursor',
    description: 'Cursor AI 代码编辑器',
    enabled: true
  },
  qwen: {
    name: 'qwen',
    displayName: '通义灵码',
    configDir: '.qwen',
    description: '阿里云通义灵码助手',
    enabled: true
  },
  codex: {
    name: 'codex',
    displayName: 'OpenAI Codex',
    configDir: '.codex',
    description: 'OpenAI Codex 编程助手',
    enabled: true
  },
  codebuddy: {
    name: 'codebuddy',
    displayName: 'CodeBuddy Code',
    configDir: '.codebuddy',
    description: '腾讯 CodeBuddy Code 助手',
    enabled: true
  },
  common: {
    name: 'common',
    displayName: '通用技能',
    configDir: '',
    description: '跨环境通用技能',
    enabled: true
  }
};

export interface SkillMeta {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  type: 'single' | 'folder';
  entry: string;
  files?: string[];
  source: 'public' | 'private' | 'builtin';
  environment: AIEnvironment;    // 所属环境
  remoteUrl?: string;
  createdAt: string;
  updatedAt: string;
  dependencies?: string[];
  config?: Record<string, unknown>;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  type: 'document' | 'code-snippet' | 'template' | 'note';
  path: string;
  tags: string[];
  category: string;
  language?: string;
  framework?: string;
  keywords: string[];
  summary: string;
  source: 'public' | 'private' | 'builtin';
  environment: AIEnvironment;    // 所属环境
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeIndex {
  version: string;
  items: KnowledgeItem[];
  categories: Record<string, string[]>;
  tagIndex: Record<string, string[]>;
}

export interface Config {
  version: string;
  initialized: boolean;
  initializedAt?: string;
  storage: {
    baseDir: string;
    skillsDir: string;
    knowledgeDir: string;
    agentsDir: string;
  };
  remotes: {
    public?: RemoteConfig;
    private?: RemoteConfig;
  };
  // 多环境配置
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
    customPatterns: CustomScanRule[];
  };
  security: {
    scanBeforePush: boolean;
    warnPublicRepo: boolean;
  };
}

export interface RemoteConfig {
  url: string;
  branch: string;
  enabled: boolean;
}

export interface LocalIndex {
  version: string;
  skills: Record<AIEnvironment, string[]>;  // 按环境分类
  knowledge: Record<AIEnvironment, string[]>;  // 按环境分类
  agents: Record<AIEnvironment, string[]>;  // Agent 配置包索引
  lastSync: {
    public: string | null;
    private: string | null;
  };
  checksum: {
    public: string;
    private: string;
  };
}

export interface SecretFinding {
  file: string;
  line: number;
  type: string;
  match: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ScanResult {
  hasSecrets: boolean;
  findings: SecretFinding[];
}

export interface SyncResult {
  success: boolean;
  pulled: number;
  pushed: number;
  conflicts: string[];
  errors: string[];
}

export interface RepoStatus {
  ahead: number;
  behind: number;
  modified: string[];
  untracked: string[];
  staged: string[];
}

export interface SkillFilter {
  source?: 'public' | 'private';
  environment?: AIEnvironment;
  tags?: string[];
  name?: string;
}

export interface KnowledgeFilter {
  type?: KnowledgeItem['type'];
  category?: string;
  environment?: AIEnvironment;
  tags?: string[];
  keywords?: string[];
}

export interface CustomScanRule {
  name: string;
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  description?: string;
}

// 默认启用的环境
const DEFAULT_ENVIRONMENTS: AIEnvironment[] = ['claude', 'cursor', 'qwen', 'codex', 'codebuddy', 'common'];

// 初始化空的技能/知识索引
function createEmptyEnvIndex(): Record<AIEnvironment, string[]> {
  return {
    claude: [],
    cursor: [],
    qwen: [],
    codex: [],
    codebuddy: [],
    common: []
  };
}

export const DEFAULT_CONFIG: Config = {
  version: '1.0.0',
  initialized: false,
  storage: {
    baseDir: '~/.qcli/data',
    skillsDir: 'skills',
    knowledgeDir: 'knowledge',
    agentsDir: 'agents'
  },
  remotes: {},
  environments: {
    enabled: DEFAULT_ENVIRONMENTS,
    default: 'common'
  },
  sync: {
    autoSync: false,
    syncInterval: 0,
    confirmBeforeSync: true
  },
  scanner: {
    enabled: true,
    skipPatterns: ['*.md', 'docs/**'],
    customPatterns: []
  },
  security: {
    scanBeforePush: true,
    warnPublicRepo: true
  }
};

export const DEFAULT_LOCAL_INDEX: LocalIndex = {
  version: '1.0.0',
  skills: createEmptyEnvIndex(),
  knowledge: createEmptyEnvIndex(),
  agents: createEmptyEnvIndex(),
  lastSync: {
    public: null,
    private: null
  },
  checksum: {
    public: '',
    private: ''
  }
};

// ============================================
// Agent 配置包相关类型
// ============================================

/**
 * Agent 工具配置
 */
export interface AgentTool {
  name: string;
  description: string;
  type: 'function' | 'resource' | 'prompt';
  config: Record<string, unknown>;
  enabled: boolean;
}

/**
 * Agent 上下文配置
 */
export interface AgentContext {
  maxTokens?: number;
  temperature?: number;
  includePaths?: string[];
  excludePatterns?: string[];
  envVariables?: Record<string, string>;
}

/**
 * Agent 其他设置
 */
export interface AgentSettings {
  model?: string;
  responseFormat?: 'text' | 'json';
  streamEnabled?: boolean;
  timeout?: number;
  customPrompt?: string;
  additionalConfig?: Record<string, unknown>;
}

/**
 * Agent 配置包元数据
 */
export interface AgentConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  environment: AIEnvironment;
  source: 'public' | 'private' | 'builtin';

  // Agent 核心配置
  systemPrompt: string;
  tools: AgentTool[];
  context: AgentContext;
  settings: AgentSettings;

  // 元数据
  versionHistory?: VersionRecord[];
  checksum: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 版本历史记录类型
// ============================================

/**
 * 版本历史记录
 */
export interface VersionRecord {
  version: string;
  checksum: string;
  message: string;
  author: string;
  timestamp: string;
  changes?: string[];
}

// ============================================
// 冲突记录类型
// ============================================

/**
 * 冲突状态
 */
export type ConflictStatus = 'pending' | 'resolved' | 'skipped';

/**
 * 冲突解决策略
 */
export type ConflictResolution = 'local' | 'remote' | 'both';

/**
 * 资源类型（用于冲突记录）
 */
export type ResourceType = 'skill' | 'knowledge' | 'agent';

/**
 * 冲突记录
 */
export interface ConflictRecord {
  resourceId: string;
  resourceName: string;
  resourceType: ResourceType;
  environment: AIEnvironment;
  localVersion: string;
  remoteVersion: string;
  localChecksum: string;
  remoteChecksum: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  detectedAt: string;
  status: ConflictStatus;
  resolution?: ConflictResolution;
}

// ============================================
// 离线操作队列类型
// ============================================

/**
 * 操作类型
 */
export type OperationType = 'push' | 'pull' | 'sync' | 'delete';

/**
 * 队列中的操作项
 */
export interface QueuedOperation {
  id: string;
  type: OperationType;
  resource: string;
  resourceType: ResourceType;
  env: AIEnvironment;
  source: 'public' | 'private';
  timestamp: string;
  payload?: Record<string, unknown>;
  retries: number;
  maxRetries: number;
  lastError?: string;
}

/**
 * 操作队列处理结果
 */
export interface ProcessResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ operationId: string; error: string }>;
}

/**
 * 离线操作队列
 */
export interface OperationQueue {
  version: string;
  pendingOperations: QueuedOperation[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 默认操作队列
 */
export const DEFAULT_OPERATION_QUEUE: OperationQueue = {
  version: '1.0.0',
  pendingOperations: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// ============================================
// Agent 过滤器
// ============================================

/**
 * Agent 查询过滤器
 */
export interface AgentFilter {
  source?: 'public' | 'private' | 'builtin';
  environment?: AIEnvironment;
  tags?: string[];
  name?: string;
}

// ============================================
// 冲突检测相关类型
// ============================================

/**
 * 冲突类型
 */
export type ConflictType = 'version' | 'content' | 'deleted';

/**
 * 冲突检测结果
 */
export interface ConflictResult {
  hasConflict: boolean;
  conflictType: ConflictType;
  localVersion: string;
  remoteVersion: string;
  localChecksum: string;
  remoteChecksum: string;
  suggestions: string[];
}

/**
 * 冲突解决结果
 */
export type Resolution = 'keep-local' | 'keep-remote' | 'keep-both' | 'skip';
