import { Command } from 'commander';
import { initSkillCommands } from './commands/skill/index.js';
import { initKnowledgeCommands } from './commands/knowledge/index.js';
import { initAgentCommands } from './commands/agent/index.js';
import { initConfigCommands } from './commands/config.js';
import { initSyncCommand } from './commands/sync.js';

const program = new Command();

program
  .name('skget')
  .description('CLI skill management tool for developers')
  .version('1.0.0')
  .option('-v, --verbose', 'enable verbose output')
  .option('--json', 'output in JSON format');

// 注册子命令
initSkillCommands(program);
initKnowledgeCommands(program);
initAgentCommands(program);
initConfigCommands(program);
initSyncCommand(program);

export { program };
