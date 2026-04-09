import { fileExists, readJson, writeJson } from '../utils/file.js';
import { expandPath } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import type { Config } from '../types/index.js';
import { DEFAULT_CONFIG } from '../types/index.js';

const CONFIG_FILE = '~/.qcli/config.json';

export class ConfigManager {
  private config: Config | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = expandPath(configPath || CONFIG_FILE);
  }

  async load(): Promise<Config> {
    if (await fileExists(this.configPath)) {
      this.config = await readJson<Config>(this.configPath);
      if (this.config) {
        return this.config;
      }
    }
    return { ...DEFAULT_CONFIG };
  }

  async save(config: Config): Promise<void> {
    this.config = config;
    await writeJson(this.configPath, config);
    logger.debug(`Config saved to ${this.configPath}`);
  }

  async get<K extends keyof Config>(key: K): Promise<Config[K] | undefined> {
    if (!this.config) {
      await this.load();
    }
    return this.config?.[key];
  }

  async set<K extends keyof Config>(key: K, value: Config[K]): Promise<void> {
    if (!this.config) {
      await this.load();
    }
    if (this.config) {
      this.config[key] = value;
      await this.save(this.config);
    }
  }

  async update(updates: Partial<Config>): Promise<void> {
    if (!this.config) {
      await this.load();
    }
    if (this.config) {
      this.config = { ...this.config, ...updates };
      await this.save(this.config);
    }
  }

  getConfig(): Config | null {
    return this.config;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  isInitialized(): boolean {
    return this.config?.initialized === true;
  }
}

// 单例
let configManagerInstance: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }
  return configManagerInstance;
}
