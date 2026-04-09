import { Command } from 'commander';
import { addKnowledge } from './add.js';
import { removeKnowledge } from './remove.js';
import { listKnowledge } from './list.js';
import { searchKnowledge } from './search.js';
import type { AIEnvironment } from '../../types/index.js';

export function initKnowledgeCommands(program: Command): void {
  const knowledge = program.command('knowledge').description('Knowledge base management commands');

  // knowledge add
  knowledge
    .command('add <path>')
    .description('Add a knowledge item from file or folder')
    .option('-t, --title <title>', 'item title')
    .option('--type <type>', 'item type (document|code-snippet|template|note)', 'document')
    .option('-c, --category <category>', 'category')
    .option('-s, --source <source>', 'source repository (public|private)', 'private')
    .option('-e, --env <environment>', 'target environment (claude|cursor|qwen|codex|codebuddy|common)', 'common')
    .option('--tags <tags>', 'tags (comma separated)')
    .option('--keywords <keywords>', 'keywords (comma separated)')
    .option('--summary <summary>', 'summary')
    .option('--skip-scan', 'skip security scan')
    .action(addKnowledge);

  // knowledge remove
  knowledge
    .command('remove <id>')
    .alias('rm')
    .description('Remove a knowledge item')
    .option('-e, --env <environment>', 'environment')
    .option('-f, --force', 'force removal without confirmation')
    .action(removeKnowledge);

  // knowledge list
  knowledge
    .command('list')
    .alias('ls')
    .description('List all knowledge items')
    .option('-e, --env <environment>', 'filter by environment')
    .option('--type <type>', 'filter by type')
    .option('-c, --category <category>', 'filter by category')
    .option('--tags <tags>', 'filter by tags (comma separated)')
    .option('--json', 'output as JSON')
    .action(listKnowledge);

  // knowledge search
  knowledge
    .command('search <keyword>')
    .description('Search knowledge items by keyword')
    .option('-e, --env <environment>', 'filter by environment')
    .option('--type <type>', 'filter by type')
    .option('-c, --category <category>', 'filter by category')
    .option('--tags <tags>', 'filter by tags (comma separated)')
    .action(searchKnowledge);
}
