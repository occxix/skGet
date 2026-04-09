import { getStorage } from '../../core/storage.js';
import { sanitizeTags } from '../../utils/helpers.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { KnowledgeItem, AIEnvironment } from '../../types/index.js';

interface ListOptions {
  env?: AIEnvironment;
  type?: KnowledgeItem['type'];
  category?: string;
  tags?: string;
  json: boolean;
}

export async function listKnowledge(options: ListOptions): Promise<void> {
  try {
    const storage = await getStorage();
    const filter: { type?: KnowledgeItem['type']; category?: string; environment?: AIEnvironment; tags?: string[] } = {};

    if (options.env) {
      filter.environment = options.env;
    }
    if (options.type) {
      filter.type = options.type;
    }
    if (options.category) {
      filter.category = options.category;
    }
    if (options.tags) {
      filter.tags = sanitizeTags(options.tags);
    }

    const items = await storage.listKnowledge(filter);

    if (items.length === 0) {
      console.log(chalk.gray('\nNo knowledge items found.\n'));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(items, null, 2));
      return;
    }

    // 表格输出
    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('Title'),
        chalk.cyan('Environment'),
        chalk.cyan('Type'),
        chalk.cyan('Category'),
        chalk.cyan('Updated')
      ],
      colWidths: [10, 22, 12, 13, 12, 18]
    });

    for (const item of items) {
      table.push([
        item.id.substring(0, 8),
        item.title,
        item.environment,
        item.type,
        item.category,
        new Date(item.updatedAt).toLocaleDateString()
      ]);
    }

    console.log('\n' + table.toString());
    console.log(chalk.gray(`\nTotal: ${items.length} item(s)\n`));
  } catch (error) {
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }
}
