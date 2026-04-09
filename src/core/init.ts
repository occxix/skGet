import { getConfigManager } from './config.js';
import { initStorage } from './storage.js';
import { fileExists } from '../utils/file.js';
import { expandPath } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_CONFIG } from '../types/index.js';

export interface FirstTimeSetupOptions {
  baseDir?: string;
  publicRepo?: string;
  privateRepo?: string;
  enableScanner?: string;
  scanBeforePush?: string;
  defaults?: boolean;
  repo?: string;
}

export async function checkFirstRun(): Promise<void> {
  const configManager = getConfigManager();
  const config = await configManager.load();

  if (!config.initialized) {
    await runFirstTimeSetup();
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value.toLowerCase() === 'true';
}

export async function runFirstTimeSetup(options: FirstTimeSetupOptions = {}): Promise<void> {
  const { select, input, confirm } = await import('@inquirer/prompts');

  // Check if running in non-interactive mode
  // Non-interactive if --defaults flag or any CLI option is provided
  const isNonInteractive = options.defaults || 
    options.baseDir !== undefined ||
    options.publicRepo !== undefined ||
    options.privateRepo !== undefined ||
    options.enableScanner !== undefined ||
    options.scanBeforePush !== undefined ||
    options.repo !== undefined;

  // Parse scanner options
  const scannerEnabledOpt = parseBoolean(options.enableScanner);
  const scanBeforePushOpt = parseBoolean(options.scanBeforePush);

  if (!isNonInteractive) {
    console.log('\n欢迎使用 Qcli\n');
    console.log('让我们完成初始配置，只需 3 个步骤\n');
  }

  // 步骤 1: 配置存储路径
  let storagePath: string;
  
  if (!isNonInteractive) {
    console.log('步骤 1/3：配置存储路径');
    console.log('─'.repeat(40));
  }

  if (options.baseDir) {
    storagePath = options.baseDir;
  } else if (isNonInteractive || options.defaults) {
    storagePath = DEFAULT_CONFIG.storage.baseDir;
  } else {
    const defaultPath = DEFAULT_CONFIG.storage.baseDir;
    storagePath = await input({
      message: `存储路径`,
      default: defaultPath,
      validate: (value) => {
        if (!value.trim()) return '请输入路径';
        return true;
      }
    });
  }

  // 步骤 2: 配置 Git 仓库
  let publicRepoUrl = options.publicRepo || '';
  let privateRepoUrl = options.privateRepo || '';

  if (!isNonInteractive) {
    console.log('\n步骤 2/3：配置 Git 仓库（可选）');
    console.log('─'.repeat(40));
  }

  // If no repo options provided and not using defaults, prompt interactively
  if (!isNonInteractive) {
    const setupGit = await confirm({
      message: '是否关联远程 Git 仓库进行同步？',
      default: false
    });

    if (setupGit) {
      const repoType = await select({
        message: '选择仓库配置方式',
        choices: [
          { value: 'public', name: '配置公共仓库' },
          { value: 'private', name: '配置私人仓库' },
          { value: 'both', name: '同时配置两种仓库' }
        ]
      });

      if (repoType === 'public' || repoType === 'both') {
        publicRepoUrl = await input({
          message: '公共仓库 URL',
          validate: (value) => {
            if (!value.trim()) return '请输入仓库 URL';
            if (!value.startsWith('http') && !value.startsWith('git@')) {
              return '请输入有效的 Git 仓库 URL';
            }
            return true;
          }
        });
      }

      if (repoType === 'private' || repoType === 'both') {
        privateRepoUrl = await input({
          message: '私人仓库 URL',
          validate: (value) => {
            if (!value.trim()) return '请输入仓库 URL';
            if (!value.startsWith('http') && !value.startsWith('git@')) {
              return '请输入有效的 Git 仓库 URL';
            }
            return true;
          }
        });
      }
    }
  }

  // 步骤 3: 权限设置
  let enableScanner: boolean;
  let scanBeforePush: boolean;

  if (!isNonInteractive) {
    console.log('\n步骤 3/3：权限设置');
    console.log('─'.repeat(40));
  }

  // Determine scanner settings
  if (scannerEnabledOpt !== undefined) {
    enableScanner = scannerEnabledOpt;
  } else if (isNonInteractive || options.defaults) {
    enableScanner = true;
  } else {
    enableScanner = await confirm({
      message: '启用敏感信息扫描？',
      default: true
    });
  }

  if (scanBeforePushOpt !== undefined) {
    scanBeforePush = scanBeforePushOpt;
  } else if (isNonInteractive || options.defaults) {
    scanBeforePush = true;
  } else {
    scanBeforePush = await confirm({
      message: '推送前强制扫描？',
      default: true
    });
  }

  // 构建配置
  const config = {
    ...DEFAULT_CONFIG,
    initialized: true,
    initializedAt: new Date().toISOString(),
    storage: {
      ...DEFAULT_CONFIG.storage,
      baseDir: storagePath
    },
    scanner: {
      ...DEFAULT_CONFIG.scanner,
      enabled: enableScanner
    },
    security: {
      ...DEFAULT_CONFIG.security,
      scanBeforePush
    }
  };

  if (options.repo) {
    config.remote = {
      url: options.repo,
      branch: 'main'
    };
  } else if (publicRepoUrl || privateRepoUrl) {
    // Backward compat: old public/private → new remote
    const repoUrl = privateRepoUrl || publicRepoUrl;
    config.remote = { url: repoUrl, branch: 'main' };
  }

  // 保存配置
  const configManager = getConfigManager();
  await configManager.save(config);

  // 初始化存储
  await initStorage(config);

  // 显示完成信息
  if (isNonInteractive) {
    console.log(JSON.stringify({
      success: true,
      configPath: configManager.getConfigPath(),
      storage: {
        baseDir: expandPath(storagePath)
      },
      remote: config.remote?.url || null,
      scanner: {
        enabled: enableScanner,
        scanBeforePush
      }
    }, null, 2));
  } else {
    console.log('\n' + '─'.repeat(50));
    console.log('\n配置完成！\n');
    console.log(`存储路径：${expandPath(storagePath)}`);
    console.log(`远程仓库：${config.remote?.url}`);
    console.log('\n运行 `qskills --help` 查看可用命令\n');
  }
}
