import { getStorage } from '../../core/storage.js';
import { sanitizeTags } from '../../utils/helpers.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { KnowledgeItem, AIEnvironment } from '../../types/index.js';

interface SearchOptions {
  env?: AIEnvironment;
  type?: KnowledgeItem['type'];
  category?: string;
  tags?: string;
}

export async function searchKnowledge(keyword: string, options: SearchOptions): Promise<void> {
  try {
    const storage = await getStorage();
    const allItems = await storage.listKnowledge({ type: options.type, category: options.category, environment: options.env });

    const lowerKeyword = keyword.toLowerCase();
    const filterTags = options.tags ? sanitizeTags(options.tags) : [];

    const results = allItems.filter(item => {
      // 标题匹配
      const titleMatch = item.title.toLowerCase().includes(lowerKeyword);
      // 摘要匹配
      const summaryMatch = item.summary.toLowerCase().includes(lowerKeyword);
      // 关键词匹配
      const keywordMatch = item.keywords.some(k => k.toLowerCase().includes(lowerKeyword));
      // 标签匹配
      const tagMatch = item.tags.some(t => t.toLowerCase().includes(lowerKeyword));

      // 额外标签过滤
      if (filterTags.length > 0) {
        const hasAllTags = filterTags.every(t => item.tags.includes(t));
        if (!hasAllTags) return false;
      }

      return titleMatch || summaryMatch || keywordMatch || tagMatch;
    });

    if (results.length === 0) {
      console.log(chalk.gray(`\nNo knowledge items found matching "${keyword}".\n`));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('Title'),
        chalk.cyan('Environment'),
        chalk.cyan('Type'),
        chalk.cyan('Summary')
      ],
      colWidths: [10, 18, 12, 12, 28]
    });

    for (const item of results) {
      table.push([
        item.id.substring(0, 8),
        item.title,
        item.environment,
        item.type,
        item.summary.substring(0, 25) + (item.summary.length > 25 ? '...' : '')
      ]);
    }

    console.log('\n' + table.toString());
    console.log(chalk.gray(`\nFound: ${results.length} item(s) matching "${keyword}"\n`));
  } catch (error) {
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }
}
