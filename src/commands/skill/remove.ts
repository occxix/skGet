import { getStorage } from '../../core/storage.js';
import { logger } from '../../utils/logger.js';
import chalk from 'chalk';
import type { AIEnvironment } from '../../types/index.js';

interface RemoveOptions {
  force: boolean;
  env?: AIEnvironment;
  source?: 'public' | 'private';
}

export async function removeSkill(name: string, options: RemoveOptions): Promise<void> {
  try {
    const storage = await getStorage();

    // 检查技能是否存在
    const skill = await storage.getSkill(name, options.env);
    if (!skill) {
      logger.error(`Skill "${name}" not found${options.env ? ` in ${options.env} environment` : ''}`);
      process.exit(1);
    }

    // 确认删除
    if (!options.force) {
      const { confirm } = await import('@inquirer/prompts');
      const proceed = await confirm({
        message: `Are you sure you want to remove "${name}" from ${skill.environment} environment?`,
        default: false
      });

      if (!proceed) {
        logger.info('Operation cancelled.');
        process.exit(0);
      }
    }

    await storage.removeSkill(name, options.env, options.source);
    console.log(chalk.green(`\n✓ Skill "${name}" removed from ${skill.environment} environment.\n`));
  } catch (error) {
    logger.error(`Failed to remove skill: ${error}`);
    process.exit(1);
  }
}
