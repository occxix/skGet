import { Command } from 'commander';
import { addAgent } from './add.js';
import { removeAgent } from './remove.js';
import { listAgents } from './list.js';
import type { AIEnvironment } from '../../types/index.js';

export function initAgentCommands(program: Command): void {
  const agent = program.command('agent')
    .alias('a')
    .description('Agent configuration management commands');

  // agent add
  agent
    .command('add <path>')
    .description('Add an agent configuration from file or folder')
    .option('-n, --name <name>', 'agent name')
    .option('-s, --source <source>', 'source repository (public|private|builtin)', 'private')
    .option('-e, --env <environment>', 'target environment (claude|cursor|qwen|codex|codebuddy|common)', 'common')
    .option('--tags <tags>', 'tags (comma separated)')
    .option('--description <desc>', 'agent description')
    .option('--skip-scan', 'skip security scan')
    .action(addAgent);

  // agent remove
  agent
    .command('remove <name>')
    .alias('rm')
    .description('Remove an agent configuration')
    .option('-e, --env <environment>', 'environment (claude|cursor|qwen|codex|codebuddy|common)')
    .option('-f, --force', 'force removal without confirmation')
    .action(removeAgent);

  // agent list
  agent
    .command('list')
    .alias('ls')
    .description('List all agent configurations')
    .option('-e, --env <environment>', 'filter by environment')
    .option('-s, --source <source>', 'filter by source (public|private|builtin)')
    .option('--tags <tags>', 'filter by tags (comma separated)')
    .option('--json', 'output as JSON')
    .action(listAgents);
}
