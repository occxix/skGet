import { getStorage } from '../../core/storage.js';
import { getScanner } from '../../core/scanner.js';
import { fileExists, readFileContent, listFiles } from '../../utils/file.js';
import { expandPath, sanitizeTags } from '../../utils/helpers.js';
import { logger } from '../../utils/logger.js';
import chalk from 'chalk';
import ora from 'ora';
import type { KnowledgeItem, AIEnvironment } from '../../types/index.js';

interface AddOptions {
  title?: string;
  type: KnowledgeItem['type'];
  category?: string;
  source: 'public' | 'private';
  env: AIEnvironment;
  tags?: string;
  keywords?: string;
  summary?: string;
  skipScan: boolean;
}

export async function addKnowledge(sourcePath: string, options: AddOptions): Promise<void> {
  const expandedPath = expandPath(sourcePath);

  // 检查源路径是否存在
  if (!(await fileExists(expandedPath))) {
    logger.error(`Path not found: ${sourcePath}`);
    process.exit(1);
  }

  // 获取或询问标题
  let title = options.title;
  if (!title) {
    const { input } = await import('@inquirer/prompts');
    title = await input({
      message: 'Title',
      validate: (value) => {
        if (!value.trim()) return 'Please enter a title';
        return true;
      }
    });
  }

  // 获取环境
  let environment = options.env;
  if (!options.env) {
    const { select } = await import('@inquirer/prompts');
    environment = await select({
      message: 'Select target environment',
      choices: [
        { value: 'claude', name: 'Claude Code' },
        { value: 'cursor', name: 'Cursor' },
        { value: 'qwen', name: '通义灵码' },
        { value: 'codex', name: 'OpenAI Codex' },
        { value: 'codebuddy', name: 'CodeBuddy Code' },
        { value: 'common', name: '通用' }
      ],
      default: 'common'
    });
  }

  // 获取其他选项
  let category = options.category || 'general';
  let tags = options.tags ? sanitizeTags(options.tags) : [];
  let keywords = options.keywords ? options.keywords.split(',').map(k => k.trim()) : [];
  let summary = options.summary || '';

  if (!options.category) {
    const { input } = await import('@inquirer/prompts');
    category = await input({
      message: 'Category',
      default: 'general'
    });
  }

  // 安全扫描
  if (!options.skipScan) {
    const spinner = ora('Scanning for sensitive information...').start();
    const scanner = getScanner();

    const files = await listFiles(expandedPath);
    const fileContents = new Map<string, string>();

    for (const file of files) {
      const content = await readFileContent(file);
      fileContents.set(file, content);
    }

    const result = await scanner.scanFiles(fileContents);
    spinner.stop();

    if (result.hasSecrets) {
      console.log(chalk.yellow('\nSensitive information detected:\n'));
      for (const finding of result.findings) {
        const severity = finding.severity === 'high' ? chalk.red('[HIGH]') :
          finding.severity === 'medium' ? chalk.yellow('[MED]') : chalk.gray('[LOW]');
        console.log(`  ${severity} ${finding.type} in ${finding.file}:${finding.line}`);
      }

      const { confirm } = await import('@inquirer/prompts');
      const proceed = await confirm({
        message: 'Continue anyway?',
        default: false
      });

      if (!proceed) {
        logger.info('Operation cancelled.');
        process.exit(0);
      }
    }
  }

  // 添加知识条目
  try {
    const storage = await getStorage();
    const item = await storage.addKnowledge(expandedPath, {
      title,
      type: options.type,
      category,
      source: options.source,
      environment: environment,
      tags,
      keywords,
      summary
    });

    console.log(chalk.green(`\n✓ Knowledge "${title}" added to ${environment} environment (ID: ${item.id}).\n`));
  } catch (error) {
    logger.error(`Failed to add knowledge: ${error}`);
    process.exit(1);
  }
}
