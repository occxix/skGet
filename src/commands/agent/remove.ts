import { getStorage } from '../../core/storage.js';
import { logger } from '../../utils/logger.js';
import type { AIEnvironment } from '../../types/index.js';

export async function removeAgent(
  name: string,
  options: {
    env?: AIEnvironment;
    force?: boolean;
  }
): Promise<void> {
  try {
    const storage = await getStorage();

    // 确认删除
    if (!options.force) {
      const { confirm } = await import('@inquirer/prompts');
      const proceed = await confirm({
        message: `Remove agent "${name}"?`,
        default: false
      });

      if (!proceed) {
        logger.info('Operation cancelled');
        return;
      }
    }

    const removed = await storage.removeAgent(name, options.env);

    if (!removed) {
      logger.fail(`Agent "${name}" not found`);
      process.exit(1);
    }
  } catch (error) {
    logger.fail(`Failed to remove agent: ${(error as Error).message}`);
    process.exit(1);
  }
}
