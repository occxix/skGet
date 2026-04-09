import { getStorage } from '../../core/storage.js';
import { logger } from '../../utils/logger.js';
import chalk from 'chalk';
import type { AIEnvironment } from '../../types/index.js';

interface RemoveOptions {
  force: boolean;
  env?: AIEnvironment;
}

export async function removeKnowledge(id: string, options: RemoveOptions): Promise<void> {
  try {
    const storage = await getStorage();

    // 检查条目是否存在
    const item = await storage.getKnowledge(id, options.env);
    if (!item) {
      logger.error(`Knowledge item "${id}" not found`);
      process.exit(1);
    }

    // 确认删除
    if (!options.force) {
      const { confirm } = await import('@inquirer/prompts');
      const proceed = await confirm({
        message: `Are you sure you want to remove "${item.title}" from ${item.environment} environment?`,
        default: false
      });

      if (!proceed) {
        logger.info('Operation cancelled.');
        process.exit(0);
      }
    }

    await storage.removeKnowledge(id, options.env);
    console.log(chalk.green(`\n✓ Knowledge "${item.title}" removed from ${item.environment} environment.\n`));
  } catch (error) {
    logger.error(`Failed to remove knowledge: ${error}`);
    process.exit(1);
  }
}
