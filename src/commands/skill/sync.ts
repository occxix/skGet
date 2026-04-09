import { getStorage } from '../../core/storage.js';
import { GitSync, getToken, isGitRepo } from '../../core/git-sync.js';
import { logger } from '../../utils/logger.js';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';

interface SyncOptions {
  source?: 'public' | 'private';
  force: boolean;
}

export async function syncSkills(options: SyncOptions): Promise<void> {
  try {
    const storage = await getStorage();
    const config = storage.getConfig();

    if (!config) {
      logger.error('Configuration not found. Please run `qskills config init` first.');
      process.exit(1);
    }

    const sources: ('public' | 'private')[] = options.source ? [options.source] : ['public', 'private'];
    const token = await getToken();

    for (const source of sources) {
      const remote = config.remotes[source];

      if (!remote || !remote.enabled) {
        console.log(chalk.gray(`\n${source} repository not configured or disabled.`));
        continue;
      }

      console.log(chalk.cyan(`\nSyncing ${source} repository...`));
      console.log(chalk.gray(`Remote: ${remote.url}`));

      const repoDir = join(
        storage.getBaseDir(),
        source === 'public' ? 'public-repo' : 'private-repo'
      );

      const gitSync = new GitSync({
        dir: repoDir,
        url: remote.url,
        branch: remote.branch,
        token: token || undefined
      });

      const spinner = ora('Checking repository...').start();

      try {
        const isRepo = await isGitRepo(repoDir);

        if (!isRepo) {
          spinner.text = 'Cloning repository...';
          await gitSync.clone();
          spinner.succeed(chalk.green('Repository cloned'));
        } else {
          // 获取状态
          const status = await gitSync.getStatus();

          if (status.modified.length > 0 || status.untracked.length > 0) {
            spinner.text = 'Committing local changes...';
            await gitSync.commit(`Update skills - ${new Date().toISOString()}`);
          }

          spinner.text = 'Pulling remote changes...';
          const pullResult = await gitSync.pull();

          if (pullResult.conflicts.length > 0) {
            spinner.fail(chalk.yellow('Conflicts detected'));
            console.log(chalk.yellow('\nConflicts in files:'));
            pullResult.conflicts.forEach(f => console.log(chalk.gray(`  - ${f}`)));

            if (!options.force) {
              console.log(chalk.yellow('\nUse --force to overwrite local changes.'));
              continue;
            }
          }

          spinner.text = 'Pushing local changes...';
          const pushResult = await gitSync.push();

          if (pullResult.pulled > 0 || pushResult.pushed > 0) {
            spinner.succeed(chalk.green(
              `Synced: ${pullResult.pulled} pulled, ${pushResult.pushed} pushed`
            ));
          } else {
            spinner.succeed(chalk.green('Already up to date'));
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        spinner.fail(chalk.red(`Sync failed: ${errorMessage}`));

        if (errorMessage.includes('Authentication')) {
          console.log(chalk.yellow('\nAuthentication failed. Please set your token:'));
          console.log(chalk.gray('  export QSKILLS_TOKEN=your_token'));
        }
      }
    }
  } catch (error) {
    logger.error(`Failed to sync: ${error}`);
    process.exit(1);
  }
}
