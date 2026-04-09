import { getStorage } from '../../core/storage.js';
import { logger } from '../../utils/logger.js';
import chalk from 'chalk';
import type { AIEnvironment } from '../../types/index.js';

interface InstallOptions {
  env: AIEnvironment;
  from?: AIEnvironment;
}

export async function installSkill(name: string, options: InstallOptions): Promise<void> {
  try {
    const storage = await getStorage();

    // 检查技能是否已存在于目标环境
    const existing = await storage.getSkill(name, options.env);
    if (existing) {
      logger.error(`Skill "${name}" already exists in ${options.env} environment`);
      process.exit(1);
    }

    // 如果指定了源环境，从该环境复制
    if (options.from) {
      const sourceSkill = await storage.getSkill(name, options.from);
      if (!sourceSkill) {
        logger.error(`Skill "${name}" not found in ${options.from} environment`);
        process.exit(1);
      }

      await storage.copySkillToEnv(name, options.from, options.env);
      console.log(chalk.green(`\n✓ Skill "${name}" installed from ${options.from} to ${options.env} environment.\n`));
      return;
    }

    // 否则，从公共仓库或其他来源安装
    // TODO: 实现从远程仓库安装的逻辑
    logger.error('Please specify --from <environment> to copy from an existing environment');
    logger.info(`Available environments: claude, cursor, qwen, codex, codebuddy, common`);
    process.exit(1);
  } catch (error) {
    logger.error(`Failed to install skill: ${error}`);
    process.exit(1);
  }
}
