import { Command } from 'commander';
import { addSkill } from './add.js';
import { removeSkill } from './remove.js';
import { listSkills } from './list.js';
import { searchSkills } from './search.js';
import { syncSkills } from './sync.js';
import { installSkill } from './install.js';
import type { AIEnvironment } from '../../types/index.js';

export function initSkillCommands(program: Command): void {
  const skill = program.command('skill')
    .alias('s')
    .description('Skill management commands');

  // skill add
  skill
    .command('add <path>')
    .description('Add a skill from file or folder')
    .option('-n, --name <name>', 'skill name')
    .option('-t, --type <type>', 'skill type (single|folder)', 'single')
    .option('-s, --source <source>', 'source repository (public|private)', 'private')
    .option('-e, --env <environment>', 'target environment (claude|cursor|qwen|codex|codebuddy|common)', 'common')
    .option('--all', 'install to all environments')
    .option('--tags <tags>', 'tags (comma separated)')
    .option('--description <desc>', 'skill description')
    .option('--skip-scan', 'skip security scan')
    .action(addSkill);

  // skill remove
  skill
    .command('remove <name>')
    .alias('rm')
    .description('Remove a skill')
    .option('-e, --env <environment>', 'environment (claude|cursor|qwen|codex|codebuddy|common)')
    .option('-s, --source <source>', 'source repository (public|private)')
    .option('-f, --force', 'force removal without confirmation')
    .action(removeSkill);

  // skill list
  skill
    .command('list')
    .alias('ls')
    .description('List all skills')
    .option('-e, --env <environment>', 'filter by environment')
    .option('-s, --source <source>', 'filter by source (public|private)')
    .option('--tags <tags>', 'filter by tags (comma separated)')
    .option('--json', 'output as JSON')
    .action(listSkills);

  // skill search
  skill
    .command('search <keyword>')
    .description('Search skills by keyword')
    .option('-e, --env <environment>', 'filter by environment')
    .option('-s, --source <source>', 'filter by source (public|private)')
    .option('--tags <tags>', 'filter by tags (comma separated)')
    .action(searchSkills);

  // skill sync
  skill
    .command('sync')
    .description('Sync skills with remote repository')
    .option('-e, --env <environment>', 'sync specific environment')
    .option('-s, --source <source>', 'sync source (public|private)')
    .option('--force', 'force overwrite local changes')
    .action(syncSkills);

  // skill install (新增: 安装技能到指定环境)
  skill
    .command('install <name>')
    .description('Install a skill to a specific environment')
    .option('-e, --env <environment>', 'target environment (required)', 'common')
    .option('--from <environment>', 'source environment to copy from')
    .action(installSkill);

  // skill copy (新增: 在环境间复制技能)
  skill
    .command('copy <name>')
    .description('Copy a skill between environments')
    .option('--from <environment>', 'source environment (required)')
    .option('--to <environment>', 'target environment (required)')
    .action(async (name: string, options: { from?: AIEnvironment; to?: AIEnvironment }) => {
      if (!options.from || !options.to) {
        console.error('Error: --from and --to options are required');
        process.exit(1);
      }
      const { getStorage } = await import('../../core/storage.js');
      const storage = await getStorage();
      await storage.copySkillToEnv(name, options.from, options.to);
    });

  // skill envs (新增: 列出所有可用环境)
  skill
    .command('envs')
    .alias('environments')
    .description('List all available environments')
    .action(async () => {
      const { AI_ENVIRONMENTS } = await import('../../types/index.js');
      console.log('\nAvailable AI environments:\n');
      for (const [key, env] of Object.entries(AI_ENVIRONMENTS)) {
        console.log(`  ${key.padEnd(12)} - ${env.displayName}`);
        console.log(`              ${env.description}`);
        console.log(`              Config: ~/${env.configDir || '(common)'}`);
        console.log();
      }
    });
}
