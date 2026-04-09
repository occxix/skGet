import { Command } from 'commander';
import { getConfigManager } from '../core/config.js';
import { runFirstTimeSetup } from '../core/init.js';
import chalk from 'chalk';
import Table from 'cli-table3';

interface InitOptions {
  baseDir?: string;
  publicRepo?: string;
  privateRepo?: string;
  enableScanner?: string;
  scanBeforePush?: string;
  defaults?: boolean;
  repo?: string;
}

export function initConfigCommands(program: Command): void {
  const config = program.command('config').description('Configuration management commands');

  // config init
  config
    .command('init')
    .description('Initialize configuration')
    .option('--baseDir <path>', 'Storage base directory')
    .option('--public-repo <url>', 'Public Git repository URL')
    .option('--private-repo <url>', 'Private Git repository URL')
    .option('--enable-scanner <boolean>', 'Enable sensitive info scanner (true/false)')
    .option('--scan-before-push <boolean>', 'Force scan before push (true/false)')
    .option('--defaults', 'Use all default values without prompts')
    .option('--repo <url>', 'Remote Git repository URL for sync')
    .action(async (options: InitOptions) => {
      await runFirstTimeSetup(options);
    });

  // config set
  config
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action(async (key: string, value: string) => {
      try {
        const manager = getConfigManager();
        await manager.load();

        // 解析值
        let parsedValue: unknown = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
        else if (value.startsWith('{') || value.startsWith('[')) {
          try {
            parsedValue = JSON.parse(value);
          } catch {
            // 保持字符串
          }
        }

        // 解析嵌套 key (如 storage.baseDir)
        const keys = key.split('.');
        if (keys.length === 1) {
          await manager.set(key as keyof import('../types/index.js').Config, parsedValue as never);
        } else {
          const currentConfig = manager.getConfig();
          if (currentConfig) {
            let obj = currentConfig as unknown as Record<string, unknown>;
            for (let i = 0; i < keys.length - 1; i++) {
              obj = obj[keys[i]] as Record<string, unknown>;
            }
            obj[keys[keys.length - 1]] = parsedValue;
            await manager.save(currentConfig);
          }
        }

        console.log(chalk.green(`\n✓ Configuration updated: ${key} = ${JSON.stringify(parsedValue)}\n`));
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });

  // config get
  config
    .command('get <key>')
    .description('Get a configuration value')
    .action(async (key: string) => {
      try {
        const manager = getConfigManager();
        await manager.load();
        const currentConfig = manager.getConfig();

        if (!currentConfig) {
          console.log(chalk.gray('No configuration found.'));
          return;
        }

        // 解析嵌套 key
        const keys = key.split('.');
        let value: unknown = currentConfig;
        for (const k of keys) {
          value = (value as Record<string, unknown>)?.[k];
        }

        if (value === undefined) {
          console.log(chalk.gray(`Key "${key}" not found.`));
        } else {
          console.log(JSON.stringify(value, null, 2));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });

  // config list
  config
    .command('list')
    .alias('ls')
    .description('List all configuration values')
    .option('--json', 'output as JSON')
    .action(async (options: { json: boolean }) => {
      try {
        const manager = getConfigManager();
        await manager.load();
        const currentConfig = manager.getConfig();

        if (!currentConfig) {
          console.log(chalk.gray('No configuration found.'));
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(currentConfig, null, 2));
          return;
        }

        console.log(chalk.cyan('\nConfiguration\n'));
        console.log(chalk.gray(`Config file: ${manager.getConfigPath()}\n`));

        const table = new Table({
          head: [chalk.cyan('Key'), chalk.cyan('Value')],
          colWidths: [25, 60]
        });

        function flattenObject(obj: Record<string, unknown>, prefix = ''): [string, string][] {
          const result: [string, string][] = [];
          for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              result.push(...flattenObject(value as Record<string, unknown>, fullKey));
            } else {
              result.push([fullKey, JSON.stringify(value)]);
            }
          }
          return result;
        }

        const entries = flattenObject(currentConfig as unknown as Record<string, unknown>);
        for (const [key, value] of entries) {
          table.push([key, value]);
        }

        console.log(table.toString() + '\n');
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });
}
