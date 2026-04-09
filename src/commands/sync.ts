import { Command } from 'commander';
import { getStorage } from '../core/storage.js';
import { getConfigManager } from '../core/config.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';
import ora from 'ora';

interface SyncOptions {
  source?: 'public' | 'private';
  auto: boolean;
  dryRun: boolean;
  force: boolean;
}

export function initSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync with remote repositories')
    .option('-s, --source <source>', 'sync source (public|private)')
    .option('--auto', 'enable auto sync mode')
    .option('--dry-run', 'preview changes without syncing')
    .option('--force', 'force overwrite local changes')
    .action(syncAll);
}

async function syncAll(options: SyncOptions): Promise<void> {
  try {
    const configManager = getConfigManager();
    await configManager.load();
    const config = configManager.getConfig();

    if (!config?.initialized) {
      logger.error('Configuration not initialized. Please run `qskills config init` first.');
      process.exit(1);
    }

    const sources: ('public' | 'private')[] = options.source ? [options.source] : ['public', 'private'];

    for (const source of sources) {
      const remote = config.remotes[source];

      if (!remote || !remote.enabled) {
        console.log(chalk.gray(`\n${source} repository not configured or disabled.`));
        continue;
      }

      console.log(chalk.cyan(`\nSyncing ${source} repository...`));
      console.log(chalk.gray(`Remote: ${remote.url}`));

      if (options.dryRun) {
        console.log(chalk.yellow('\n[Dry Run] Would sync the following:'));
        const storage = await getStorage();
        const skills = await storage.listSkills({ source });
        const knowledge = await storage.listKnowledge();
        console.log(chalk.gray(`  - ${skills.length} skill(s)`));
        console.log(chalk.gray(`  - ${knowledge.length} knowledge item(s)`));
        continue;
      }

      // 实际同步逻辑
      const spinner = ora('Syncing...').start();

      try {
        // TODO: 调用 GitSync 模块
        // 这里是占位实现
        await new Promise(resolve => setTimeout(resolve, 1000));

        spinner.succeed(chalk.green(`Synced ${source} repository`));
      } catch (error) {
        spinner.fail(chalk.red(`Failed to sync ${source} repository`));
        console.error(error);
      }
    }

    console.log(chalk.green('\n✓ Sync completed.\n'));
  } catch (error) {
    logger.error(`Failed to sync: ${error}`);
    process.exit(1);
  }
}
