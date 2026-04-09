import { getStorage } from '../../core/storage.js';
import { sanitizeTags } from '../../utils/helpers.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { AIEnvironment } from '../../types/index.js';

interface SearchOptions {
  env?: AIEnvironment;
  source?: 'public' | 'private';
  tags?: string;
}

export async function searchSkills(keyword: string, options: SearchOptions): Promise<void> {
  try {
    const storage = await getStorage();
    const allSkills = await storage.listSkills({ source: options.source, environment: options.env });

    const lowerKeyword = keyword.toLowerCase();
    const filterTags = options.tags ? sanitizeTags(options.tags) : [];

    const results = allSkills.filter(skill => {
      // 名称匹配
      const nameMatch = skill.name.toLowerCase().includes(lowerKeyword);
      // 描述匹配
      const descMatch = skill.description.toLowerCase().includes(lowerKeyword);
      // 标签匹配
      const tagMatch = skill.tags.some(t => t.toLowerCase().includes(lowerKeyword));

      // 额外标签过滤
      if (filterTags.length > 0) {
        const hasAllTags = filterTags.every(t => skill.tags.includes(t));
        if (!hasAllTags) return false;
      }

      return nameMatch || descMatch || tagMatch;
    });

    if (results.length === 0) {
      console.log(chalk.gray(`\nNo skills found matching "${keyword}".\n`));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('Name'),
        chalk.cyan('Environment'),
        chalk.cyan('Type'),
        chalk.cyan('Tags'),
        chalk.cyan('Description')
      ],
      colWidths: [18, 12, 10, 22, 30]
    });

    for (const skill of results) {
      table.push([
        skill.name,
        skill.environment,
        skill.type,
        skill.tags.join(', ') || '-',
        skill.description.substring(0, 30) + (skill.description.length > 30 ? '...' : '')
      ]);
    }

    console.log('\n' + table.toString());
    console.log(chalk.gray(`\nFound: ${results.length} skill(s) matching "${keyword}"\n`));
  } catch (error) {
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }
}
