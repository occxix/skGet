import { join } from 'path';
import { fileExists, ensureDir, readJson, writeJson, listFiles, listDirectories, copyDirectory, removeDirectory, readFileContent } from '../utils/file.js';
import { generateId, expandPath, formatDate } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import type { Config, SkillMeta, KnowledgeItem, LocalIndex, SkillFilter, KnowledgeFilter, AIEnvironment, AI_ENVIRONMENTS, AgentConfig, AgentFilter } from '../types/index.js';
import { DEFAULT_LOCAL_INDEX } from '../types/index.js';

const CONFIG_FILE = '~/.qcli/config.json';
const INDEX_FILE = 'index.json';

// 所有支持的环境
const ALL_ENVIRONMENTS: AIEnvironment[] = ['claude', 'cursor', 'qwen', 'codex', 'codebuddy', 'common'];

export class Storage {
  private config: Config | null = null;
  private index: LocalIndex | null = null;
  private configPath: string;
  private baseDir: string = '';

  constructor(configPath?: string) {
    this.configPath = expandPath(configPath || CONFIG_FILE);
  }

  async init(config?: Config): Promise<void> {
    // 加载或创建配置
    if (await fileExists(this.configPath)) {
      this.config = await readJson<Config>(this.configPath);

      // 向后兼容：添加缺失的 environments 配置
      if (this.config && !this.config.environments) {
        this.config.environments = {
          enabled: ALL_ENVIRONMENTS,
          default: 'common'
        };
        await this.saveConfig();
      }
    } else if (config) {
      this.config = config;
      await this.saveConfig();
    } else {
      throw new Error('Configuration not found. Please run `sksync config init` first.');
    }

    if (this.config) {
      this.baseDir = expandPath(this.config.storage.baseDir);
      await ensureDir(this.baseDir);

      // 为每个环境创建目录结构
      for (const env of ALL_ENVIRONMENTS) {
        await ensureDir(join(this.baseDir, this.config.storage.skillsDir, env));
        await ensureDir(join(this.baseDir, this.config.storage.knowledgeDir, env));
      }

      // 创建 agents 目录
      if (this.config.storage.agentsDir) {
        for (const env of ALL_ENVIRONMENTS) {
          await ensureDir(join(this.baseDir, this.config.storage.agentsDir, env));
        }
      }

      // 加载或创建索引
      await this.loadOrCreateIndex();
    }
  }

  getConfig(): Config | null {
    return this.config;
  }

  async updateConfig(updates: Partial<Config>): Promise<void> {
    if (this.config) {
      this.config = { ...this.config, ...updates };
      await this.saveConfig();
    }
  }

  private async saveConfig(): Promise<void> {
    await writeJson(this.configPath, this.config);
  }

  private async loadOrCreateIndex(): Promise<void> {
    const indexPath = join(this.baseDir, INDEX_FILE);
    if (await fileExists(indexPath)) {
      this.index = await readJson<LocalIndex>(indexPath);
      // 确保索引包含所有环境
      if (this.index) {
        for (const env of ALL_ENVIRONMENTS) {
          if (!this.index.skills[env]) {
            this.index.skills[env] = [];
          }
          if (!this.index.knowledge[env]) {
            this.index.knowledge[env] = [];
          }
          // 向后兼容：添加 agents 字段
          if (!this.index.agents) {
            this.index.agents = {} as Record<AIEnvironment, string[]>;
          }
          if (!this.index.agents[env]) {
            this.index.agents[env] = [];
          }
        }
        await this.saveIndex();
      }
    } else {
      this.index = { ...DEFAULT_LOCAL_INDEX };
      await this.saveIndex();
    }
  }

  private async saveIndex(): Promise<void> {
    if (this.index) {
      await writeJson(join(this.baseDir, INDEX_FILE), this.index);
    }
  }

  // 获取所有可用环境
  getAvailableEnvironments(): AIEnvironment[] {
    return ALL_ENVIRONMENTS;
  }

  // 获取启用的环境
  getEnabledEnvironments(): AIEnvironment[] {
    return this.config?.environments.enabled || ALL_ENVIRONMENTS;
  }

  // 获取默认环境
  getDefaultEnvironment(): AIEnvironment {
    return this.config?.environments.default || 'common';
  }

  // Skill 操作
  async addSkill(
    sourcePath: string,
    options: {
      name: string;
      type: 'single' | 'folder';
      source: 'public' | 'private';
      environment: AIEnvironment;
      description?: string;
      tags?: string[];
    }
  ): Promise<SkillMeta> {
    if (!this.config) throw new Error('Storage not initialized');

    const skillId = generateId();
    const skillDir = join(
      this.baseDir,
      this.config.storage.skillsDir,
      options.environment,
      options.name
    );

    await ensureDir(skillDir);

    const now = formatDate(new Date());
    const skillMeta: SkillMeta = {
      id: skillId,
      name: options.name,
      version: '1.0.0',
      description: options.description || '',
      author: '',
      tags: options.tags || [],
      type: options.type,
      entry: options.type === 'single' ? 'index.js' : '',
      source: options.source,
      environment: options.environment,
      createdAt: now,
      updatedAt: now
    };

    if (options.type === 'folder') {
      await copyDirectory(sourcePath, skillDir);
      const files = await listFiles(skillDir);
      skillMeta.files = files.map(f => f.replace(skillDir, ''));
    } else {
      // 单文件复制
      const { copyFile } = await import('fs/promises');
      await copyFile(expandPath(sourcePath), join(skillDir, 'index.js'));
      skillMeta.files = ['index.js'];
    }

    // 保存元数据
    await writeJson(join(skillDir, 'skill.json'), skillMeta);

    // 更新索引
    if (this.index) {
      if (!this.index.skills[options.environment]) {
        this.index.skills[options.environment] = [];
      }
      this.index.skills[options.environment].push(skillId);
      await this.saveIndex();
    }

    logger.success(`Skill "${options.name}" added to ${options.environment} environment`);
    return skillMeta;
  }

  async removeSkill(name: string, environment?: AIEnvironment, source?: 'public' | 'private'): Promise<boolean> {
    if (!this.config || !this.index) throw new Error('Storage not initialized');

    const envs: AIEnvironment[] = environment ? [environment] : ALL_ENVIRONMENTS;

    for (const env of envs) {
      const skillDir = join(this.baseDir, this.config.storage.skillsDir, env, name);
      if (await fileExists(skillDir)) {
        const meta = await readJson<SkillMeta>(join(skillDir, 'skill.json'));

        // 如果指定了 source，检查是否匹配
        if (source && meta && meta.source !== source) {
          continue;
        }

        await removeDirectory(skillDir);

        // 更新索引
        if (meta && this.index.skills[env]) {
          this.index.skills[env] = this.index.skills[env].filter(id => id !== meta.id);
          await this.saveIndex();
        }

        logger.success(`Skill "${name}" removed from ${env} environment`);
        return true;
      }
    }

    logger.fail(`Skill "${name}" not found`);
    return false;
  }

  async getSkill(name: string, environment?: AIEnvironment): Promise<SkillMeta | null> {
    if (!this.config) throw new Error('Storage not initialized');

    const envs: AIEnvironment[] = environment ? [environment] : ALL_ENVIRONMENTS;

    for (const env of envs) {
      const metaPath = join(this.baseDir, this.config.storage.skillsDir, env, name, 'skill.json');
      const meta = await readJson<SkillMeta>(metaPath);
      if (meta) return meta;
    }

    return null;
  }

  async listSkills(filter?: SkillFilter): Promise<SkillMeta[]> {
    if (!this.config) throw new Error('Storage not initialized');

    const skills: SkillMeta[] = [];
    let envs: AIEnvironment[] = filter?.environment ? [filter.environment] : ALL_ENVIRONMENTS;

    // 只查询启用的环境
    const enabledEnvs = this.getEnabledEnvironments();
    envs = envs.filter(e => enabledEnvs.includes(e));

    for (const env of envs) {
      const skillDir = join(this.baseDir, this.config.storage.skillsDir, env);
      if (!await fileExists(skillDir)) continue;

      const dirs = await listDirectories(skillDir);

      for (const dir of dirs) {
        const meta = await readJson<SkillMeta>(join(dir, 'skill.json'));
        if (meta) {
          // 应用过滤器
          if (filter?.source && meta.source !== filter.source) continue;
          if (filter?.tags && filter.tags.length > 0) {
            const hasTag = filter.tags.some(t => meta.tags.includes(t));
            if (!hasTag) continue;
          }
          if (filter?.name && !meta.name.includes(filter.name)) {
            continue;
          }
          skills.push(meta);
        }
      }
    }

    return skills;
  }

  // 将技能复制到另一个环境
  async copySkillToEnv(name: string, fromEnv: AIEnvironment, toEnv: AIEnvironment): Promise<boolean> {
    if (!this.config) throw new Error('Storage not initialized');

    const sourceDir = join(this.baseDir, this.config.storage.skillsDir, fromEnv, name);
    const targetDir = join(this.baseDir, this.config.storage.skillsDir, toEnv, name);

    if (!await fileExists(sourceDir)) {
      logger.fail(`Skill "${name}" not found in ${fromEnv} environment`);
      return false;
    }

    if (await fileExists(targetDir)) {
      logger.fail(`Skill "${name}" already exists in ${toEnv} environment`);
      return false;
    }

    await copyDirectory(sourceDir, targetDir);

    // 更新元数据
    const meta = await readJson<SkillMeta>(join(targetDir, 'skill.json'));
    if (meta) {
      meta.environment = toEnv;
      meta.id = generateId();
      meta.updatedAt = formatDate(new Date());
      await writeJson(join(targetDir, 'skill.json'), meta);

      // 更新索引
      if (this.index) {
        if (!this.index.skills[toEnv]) {
          this.index.skills[toEnv] = [];
        }
        this.index.skills[toEnv].push(meta.id);
        await this.saveIndex();
      }
    }

    logger.success(`Skill "${name}" copied from ${fromEnv} to ${toEnv}`);
    return true;
  }

  // Knowledge 操作
  async addKnowledge(
    sourcePath: string,
    options: {
      title: string;
      type: KnowledgeItem['type'];
      category: string;
      source: 'public' | 'private';
      environment: AIEnvironment;
      tags?: string[];
      keywords?: string[];
      summary?: string;
    }
  ): Promise<KnowledgeItem> {
    if (!this.config) throw new Error('Storage not initialized');

    const id = generateId();
    const destPath = join(
      this.baseDir,
      this.config.storage.knowledgeDir,
      options.environment,
      id
    );

    await ensureDir(destPath);

    // 复制文件
    const { copyFile, stat } = await import('fs/promises');
    const stats = await stat(expandPath(sourcePath));
    const isDir = stats.isDirectory();

    if (isDir) {
      await copyDirectory(sourcePath, destPath);
    } else {
      await copyFile(expandPath(sourcePath), join(destPath, 'content'));
    }

    const now = formatDate(new Date());
    const item: KnowledgeItem = {
      id,
      title: options.title,
      type: options.type,
      path: destPath,
      tags: options.tags || [],
      category: options.category,
      keywords: options.keywords || [],
      summary: options.summary || '',
      source: options.source,
      environment: options.environment,
      createdAt: now,
      updatedAt: now
    };

    // 保存元数据
    await writeJson(join(destPath, 'knowledge.json'), item);

    // 更新索引
    if (this.index) {
      if (!this.index.knowledge[options.environment]) {
        this.index.knowledge[options.environment] = [];
      }
      this.index.knowledge[options.environment].push(id);
      await this.saveIndex();
    }

    logger.success(`Knowledge "${options.title}" added to ${options.environment} environment`);
    return item;
  }

  async removeKnowledge(id: string, environment?: AIEnvironment): Promise<boolean> {
    if (!this.config || !this.index) throw new Error('Storage not initialized');

    const envs: AIEnvironment[] = environment ? [environment] : ALL_ENVIRONMENTS;

    for (const env of envs) {
      const itemPath = join(this.baseDir, this.config.storage.knowledgeDir, env, id);
      if (await fileExists(itemPath)) {
        await removeDirectory(itemPath);

        // 更新索引
        if (this.index.knowledge[env]) {
          this.index.knowledge[env] = this.index.knowledge[env].filter(i => i !== id);
          await this.saveIndex();
        }

        logger.success(`Knowledge "${id}" removed from ${env} environment`);
        return true;
      }
    }

    logger.fail(`Knowledge "${id}" not found`);
    return false;
  }

  async getKnowledge(id: string, environment?: AIEnvironment): Promise<KnowledgeItem | null> {
    if (!this.config) throw new Error('Storage not initialized');

    const envs: AIEnvironment[] = environment ? [environment] : ALL_ENVIRONMENTS;

    for (const env of envs) {
      const metaPath = join(this.baseDir, this.config.storage.knowledgeDir, env, id, 'knowledge.json');
      const item = await readJson<KnowledgeItem>(metaPath);
      if (item) return item;
    }

    return null;
  }

  async listKnowledge(filter?: KnowledgeFilter): Promise<KnowledgeItem[]> {
    if (!this.config) throw new Error('Storage not initialized');

    const items: KnowledgeItem[] = [];
    let envs: AIEnvironment[] = filter?.environment ? [filter.environment] : ALL_ENVIRONMENTS;

    // 只查询启用的环境
    const enabledEnvs = this.getEnabledEnvironments();
    envs = envs.filter(e => enabledEnvs.includes(e));

    for (const env of envs) {
      const knowledgeDir = join(this.baseDir, this.config.storage.knowledgeDir, env);
      if (!await fileExists(knowledgeDir)) continue;

      const dirs = await listDirectories(knowledgeDir);

      for (const dir of dirs) {
        const item = await readJson<KnowledgeItem>(join(dir, 'knowledge.json'));
        if (item) {
          // 应用过滤器
          if (filter?.type && item.type !== filter.type) continue;
          if (filter?.category && item.category !== filter.category) continue;
          if (filter?.tags && filter.tags.length > 0) {
            const hasTag = filter.tags.some(t => item.tags.includes(t));
            if (!hasTag) continue;
          }
          items.push(item);
        }
      }
    }

    return items;
  }

  // Agent 操作
  async addAgent(
    sourcePath: string,
    options: {
      name: string;
      source: 'public' | 'private' | 'builtin';
      environment: AIEnvironment;
      description?: string;
      tags?: string[];
    }
  ): Promise<AgentConfig> {
    if (!this.config) throw new Error('Storage not initialized');
    if (!this.config.storage.agentsDir) throw new Error('Agents storage not configured');

    const agentId = generateId();
    const agentDir = join(
      this.baseDir,
      this.config.storage.agentsDir,
      options.environment,
      options.name
    );

    await ensureDir(agentDir);

    const now = formatDate(new Date());
    const agentMeta: AgentConfig = {
      id: agentId,
      name: options.name,
      version: '1.0.0',
      description: options.description || '',
      author: '',
      tags: options.tags || [],
      environment: options.environment,
      source: options.source,
      systemPrompt: '',
      tools: [],
      context: {},
      settings: {},
      checksum: '',
      createdAt: now,
      updatedAt: now
    };

    // 复制源文件
    const stats = await (await import('fs/promises')).stat(expandPath(sourcePath));
    if (stats.isDirectory()) {
      await copyDirectory(sourcePath, agentDir);
    } else {
      await (await import('fs/promises')).copyFile(expandPath(sourcePath), join(agentDir, 'agent.json'));
    }

    // 保存元数据
    await writeJson(join(agentDir, 'agent.json'), agentMeta);

    // 更新索引
    if (this.index) {
      if (!this.index.agents) {
        this.index.agents = {} as Record<AIEnvironment, string[]>;
      }
      if (!this.index.agents[options.environment]) {
        this.index.agents[options.environment] = [];
      }
      this.index.agents[options.environment].push(agentId);
      await this.saveIndex();
    }

    logger.success(`Agent "${options.name}" added to ${options.environment} environment`);
    return agentMeta;
  }

  async removeAgent(name: string, environment?: AIEnvironment): Promise<boolean> {
    if (!this.config || !this.index) throw new Error('Storage not initialized');
    if (!this.config.storage.agentsDir) throw new Error('Agents storage not configured');

    const envs: AIEnvironment[] = environment ? [environment] : ALL_ENVIRONMENTS;

    for (const env of envs) {
      const agentDir = join(this.baseDir, this.config.storage.agentsDir, env, name);
      if (await fileExists(agentDir)) {
        const meta = await readJson<AgentConfig>(join(agentDir, 'agent.json'));

        await removeDirectory(agentDir);

        // 更新索引
        if (meta && this.index.agents && this.index.agents[env]) {
          this.index.agents[env] = this.index.agents[env].filter(id => id !== meta.id);
          await this.saveIndex();
        }

        logger.success(`Agent "${name}" removed from ${env} environment`);
        return true;
      }
    }

    logger.fail(`Agent "${name}" not found`);
    return false;
  }

  async getAgent(name: string, environment?: AIEnvironment): Promise<AgentConfig | null> {
    if (!this.config) throw new Error('Storage not initialized');
    if (!this.config.storage.agentsDir) return null;

    const envs: AIEnvironment[] = environment ? [environment] : ALL_ENVIRONMENTS;

    for (const env of envs) {
      const metaPath = join(this.baseDir, this.config.storage.agentsDir, env, name, 'agent.json');
      const meta = await readJson<AgentConfig>(metaPath);
      if (meta) return meta;
    }

    return null;
  }

  async listAgents(filter?: AgentFilter): Promise<AgentConfig[]> {
    if (!this.config) throw new Error('Storage not initialized');
    if (!this.config.storage.agentsDir) return [];

    const agents: AgentConfig[] = [];
    let envs: AIEnvironment[] = filter?.environment ? [filter.environment] : ALL_ENVIRONMENTS;

    // 只查询启用的环境
    const enabledEnvs = this.getEnabledEnvironments();
    envs = envs.filter(e => enabledEnvs.includes(e));

    for (const env of envs) {
      const agentDir = join(this.baseDir, this.config.storage.agentsDir, env);
      if (!await fileExists(agentDir)) continue;

      const dirs = await listDirectories(agentDir);

      for (const dir of dirs) {
        const meta = await readJson<AgentConfig>(join(dir, 'agent.json'));
        if (meta) {
          // 应用过滤器
          if (filter?.source && meta.source !== filter.source) continue;
          if (filter?.tags && filter.tags.length > 0) {
            const hasTag = filter.tags.some(t => meta.tags.includes(t));
            if (!hasTag) continue;
          }
          if (filter?.name && !meta.name.includes(filter.name)) {
            continue;
          }
          agents.push(meta);
        }
      }
    }

    return agents;
  }

  getIndex(): LocalIndex | null {
    return this.index;
  }

  getBaseDir(): string {
    return this.baseDir;
  }
}

// 单例
let storageInstance: Storage | null = null;

export async function getStorage(): Promise<Storage> {
  if (!storageInstance) {
    storageInstance = new Storage();
    await storageInstance.init();
  }
  return storageInstance;
}

export async function initStorage(config: Config): Promise<Storage> {
  storageInstance = new Storage();
  await storageInstance.init(config);
  return storageInstance;
}
