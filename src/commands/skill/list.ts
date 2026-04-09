import { getStorage } from '../../core/storage.js';
import { sanitizeTags } from '../../utils/helpers.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { AIEnvironment } from '../../types/index.js';

interface ListOptions {
  env?: AIEnvironment;
  source?: 'public' | 'private';
  tags?: string;
  json: boolean;
}

export async function listSkills(options: ListOptions): Promise<void> {
  try {
    const storage = await getStorage();
    const filter: { environment?: AIEnvironment; source?: 'public' | 'private'; tags?: string[] } = {};

    if (options.env) {
      filter.environment = options.env;
    }
    if (options.source) {
      filter.source = options.source;
    }
    if (options.tags) {
      filter.tags = sanitizeTags(options.tags);
    }

    const skills = await storage.listSkills(filter);

    if (skills.length === 0) {
      console.log(chalk.gray('\nNo skills found.\n'));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(skills, null, 2));
      return;
    }

    // 表格输出
    const table = new Table({
      head: [
        chalk.cyan('Name'),
        chalk.cyan('Environment'),
        chalk.cyan('Type'),
        chalk.cyan('Source'),
        chalk.cyan('Tags'),
        chalk.cyan('Updated')
      ],
      colWidths: [18, 12, 10, 10, 25, 18]
    });

    for (const skill of skills) {
      table.push([
        skill.name,
        skill.environment,
        skill.type,
        skill.source,
        skill.tags.join(', ') || '-',
        new Date(skill.updatedAt).toLocaleDateString()
      ]);
    }

    console.log('\n' + table.toString());
    console.log(chalk.gray(`\nTotal: ${skills.length} skill(s)\n`));
  } catch (error) {
    console.error(chalk.red(`Error: ${error}`));
    process.exit(1);
  }
}
