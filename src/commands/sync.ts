import { Command } from 'commander';
import { getSyncService, resetSyncService, type SyncOptions } from '../core/sync-service.js';
import chalk from 'chalk';
import Table from 'cli-table3';

export function initSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync with remote Git repository')
    .argument('[action]', 'sub-action: push | pull | status | resolve')
    .option('-e, --env <envs...>', 'sync specific environments')
    .option('--pull', 'pull from remote only')
    .option('--status', 'show sync status')
    .option('--json', 'output as JSON')
    .option('--dry-run', 'preview changes without executing')
    .option('--force', 'force overwrite (use remote version on conflict)')
    .option('--strategy <strategy>', 'conflict strategy: local-first | remote-first')
    .option('--resolution <json>', 'conflict resolution JSON (use with resolve)')
    .action(syncHandler);
}

function parseEnvs(envs: string[] | undefined): string[] | undefined {
  if (!envs) return undefined;
  // Support comma-separated values: --env claude,cursor or --env claude cursor
  const all: string[] = [];
  for (const e of envs) {
    all.push(...e.split(',').map(s => s.trim()).filter(Boolean));
  }
  return all.length > 0 ? all : undefined;
}

async function syncHandler(
  action: string | undefined,
  options: {
    env?: string[];
    pull?: boolean;
    status?: boolean;
    json?: boolean;
    dryRun?: boolean;
    force?: boolean;
    strategy?: string;
    resolution?: string;
  }
): Promise<void> {
  try {
    resetSyncService(); // Reset to pick up latest config
    const service = await getSyncService();
    const isJson = !!options.json;
    const envs = parseEnvs(options.env) as SyncOptions['environments'];

    const syncOptions: SyncOptions = {
      environments: envs,
      json: isJson,
      dryRun: options.dryRun,
      force: options.force,
      strategy: options.strategy as SyncOptions['strategy']
    };

    // Route sub-actions
    if (action === 'status' || options.status) {
      const status = await service.status();
      if (isJson) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        outputStatus(status);
      }
      return;
    }

    if (action === 'push') {
      const result = await service.push(syncOptions);
      outputResult(result, isJson);
      return;
    }

    if (action === 'pull') {
      const result = await service.pull(syncOptions);
      outputResult(result, isJson);
      return;
    }

    if (action === 'resolve') {
      if (!options.resolution) {
        console.error(chalk.red('Error: --resolution <json> is required for resolve action'));
        process.exit(1);
      }
      const resolutions = JSON.parse(options.resolution);
      const result = await service.resolve(resolutions);
      outputResult(result, isJson);
      return;
    }

    // Default: bidirectional sync
    if (options.pull) {
      const result = await service.pull(syncOptions);
      outputResult(result, isJson);
    } else {
      const result = await service.sync(syncOptions);
      outputResult(result, isJson);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);

    if (errMsg.includes('REMOTE_NOT_CONFIGURED')) {
      console.error(chalk.red('\nError: No remote repository configured.\n'));
      console.error(chalk.gray('  sksync config set remote.url <git-url>'));
      console.error(chalk.gray('  sksync config set remote.branch main\n'));
    } else {
      console.error(chalk.red(`Error: ${errMsg}`));
    }
    process.exit(1);
  }
}

function outputResult(result: any, isJson: boolean): void {
  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    console.log(chalk.green('\n  Sync successful\n'));
    if (result.summary) {
      const s = result.summary;
      if (s.filesAdded > 0) console.log(chalk.gray(`  Files added:    ${s.filesAdded}`));
      if (s.filesModified > 0) console.log(chalk.gray(`  Files modified: ${s.filesModified}`));
      if (s.filesDeleted > 0) console.log(chalk.gray(`  Files deleted:  ${s.filesDeleted}`));
      if (s.filesAdded === 0 && s.filesModified === 0 && s.filesDeleted === 0) {
        console.log(chalk.gray('  Already up to date'));
      }
    }
    if (result.commitSha) {
      console.log(chalk.gray(`  Commit: ${result.commitSha}`));
    }
    console.log();
  } else {
    console.log(chalk.yellow('\n  Sync completed with issues\n'));

    if (result.errors?.length > 0) {
      for (const err of result.errors) {
        console.log(chalk.red(`  [${err.code}] ${err.message}`));
      }
    }

    if (result.conflicts?.length > 0) {
      console.log(chalk.yellow(`\n  Conflicts detected: ${result.conflicts.length}\n`));
      const table = new Table({
        head: ['File', 'Type', 'Environment'],
        colWidths: [40, 15, 15]
      });
      for (const c of result.conflicts) {
        table.push([c.file, c.type, c.environment || '-']);
      }
      console.log(table.toString());

      if (result.action === 'sync') {
        console.log(chalk.gray('\n  Resolve conflicts manually, then run `sksync sync` again.'));
      }
      console.log();
    }
  }
}

function outputStatus(status: any): void {
  console.log(chalk.cyan('\n  Sync Status'));
  console.log('  ' + '─'.repeat(40));

  if (!status.remoteConfigured) {
    console.log(chalk.yellow('\n  Remote: Not configured'));
    console.log(chalk.gray('  Run: sksync config set remote.url <git-url>\n'));
    return;
  }

  console.log(chalk.gray(`  Remote:  ${status.remoteUrl}`));
  console.log(chalk.gray(`  Branch:  ${status.branch}`));
  console.log(chalk.gray(`  Status:  ${status.connected ? 'Connected' : 'Offline'}`));
  console.log(chalk.gray(`  Repo:    ${status.isGitRepo ? 'Initialized' : 'Not initialized'}`));
  console.log();

  if (status.isGitRepo) {
    const aheadStr = status.ahead > 0 ? chalk.green(`${status.ahead} ahead`) : chalk.gray('0 ahead');
    const behindStr = status.behind > 0 ? chalk.yellow(`${status.behind} behind`) : chalk.gray('0 behind');
    console.log(`  ${aheadStr}  /  ${behindStr}`);

    if (status.modified.length > 0) {
      console.log(chalk.yellow(`  Modified (${status.modified.length}):`));
      for (const f of status.modified.slice(0, 10)) {
        console.log(chalk.gray(`    - ${f}`));
      }
    }
    if (status.untracked.length > 0) {
      console.log(chalk.gray(`  Untracked (${status.untracked.length}):`));
      for (const f of status.untracked.slice(0, 10)) {
        console.log(chalk.gray(`    - ${f}`));
      }
    }
    if (status.modified.length === 0 && status.untracked.length === 0 && status.ahead === 0 && status.behind === 0) {
      console.log(chalk.green('  Everything is up to date'));
    }
  }

  console.log();
}
