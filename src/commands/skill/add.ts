import { getStorage } from '../../core/storage.js';
import { getScanner } from '../../core/scanner.js';
import { fileExists, readFileContent, listFiles, isFile, isDirectory } from '../../utils/file.js';
import { expandPath, validateName, sanitizeTags } from '../../utils/helpers.js';
import { logger } from '../../utils/logger.js';
import chalk from 'chalk';
import ora from 'ora';
import type { AIEnvironment } from '../../types/index.js';

interface AddOptions {
  name?: string;
  type: 'single' | 'folder';
  source: 'public' | 'private';
  env: AIEnvironment;
  tags?: string;
  description?: string;
  skipScan: boolean;
  all: boolean;
}

export async function addSkill(sourcePath: string, options: AddOptions): Promise<void> {
  const expandedPath = expandPath(sourcePath);

  // 检查源路径是否存在
  if (!(await fileExists(expandedPath))) {
    logger.error(`Path not found: ${sourcePath}`);
    process.exit(1);
  }

  // 获取或询问技能名称
  let skillName = options.name;
  if (!skillName) {
    const { input } = await import('@inquirer/prompts');
    skillName = await input({
      message: 'Skill name',
      validate: (value) => {
        if (!value.trim()) return 'Please enter a skill name';
        if (!validateName(value)) return 'Name can only contain letters, numbers, hyphens and underscores';
        return true;
      }
    });
  }

  if (!validateName(skillName)) {
    logger.error('Invalid skill name. Use only letters, numbers, hyphens and underscores.');
    process.exit(1);
  }

  // 获取其他选项
  let environment = options.env;
  let description = options.description;
  let tags = options.tags ? sanitizeTags(options.tags) : [];

  // 交互式选择环境（如果没有指定 --all 或 --env）
  if (!options.all && !options.env) {
    const { select } = await import('@inquirer/prompts');
    environment = await select({
      message: 'Select target environment',
      choices: [
        { value: 'claude', name: 'Claude Code - Anthropic Claude Code assistant' },
        { value: 'cursor', name: 'Cursor - Cursor AI code editor' },
        { value: 'qwen', name: '通义灵码 - Alibaba Qwen assistant' },
        { value: 'codex', name: 'OpenAI Codex - OpenAI programming assistant' },
        { value: 'codebuddy', name: 'CodeBuddy Code - Tencent CodeBuddy assistant' },
        { value: 'common', name: '通用 - Cross-environment common skills' }
      ],
      default: 'common'
    });
  }

  if (!options.description) {
    const { input } = await import('@inquirer/prompts');
    description = await input({
      message: 'Description (optional)',
      default: ''
    });
  }

  if (!options.tags) {
    const { input } = await import('@inquirer/prompts');
    const tagInput = await input({
      message: 'Tags (comma separated, optional)',
      default: ''
    });
    tags = sanitizeTags(tagInput);
  }

  // 安全扫描
  if (!options.skipScan) {
    const spinner = ora('Scanning for sensitive information...').start();
    const scanner = getScanner();

    const fileContents = new Map<string, string>();

    // 检查是文件还是目录
    if (await isFile(expandedPath)) {
      const content = await readFileContent(expandedPath);
      fileContents.set(expandedPath, content);
    } else if (await isDirectory(expandedPath)) {
      const files = await listFiles(expandedPath);
      for (const file of files) {
        const content = await readFileContent(file);
        fileContents.set(file, content);
      }
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

  // 添加技能
  try {
    const storage = await getStorage();

    // 如果指定 --all，安装到所有环境
    if (options.all) {
      const allEnv: AIEnvironment[] = ['claude', 'cursor', 'qwen', 'codex', 'codebuddy', 'common'];
      console.log(chalk.cyan(`\nInstalling "${skillName}" to all environments...\n`));

      for (const env of allEnv) {
        await storage.addSkill(expandedPath, {
          name: skillName,
          type: options.type,
          source: options.source,
          environment: env,
          description: description || '',
          tags
        });
        console.log(chalk.gray(`  ✓ ${env}`));
      }

      console.log(chalk.green(`\n✓ Skill "${skillName}" added to all ${allEnv.length} environments.\n`));
    } else {
      await storage.addSkill(expandedPath, {
        name: skillName,
        type: options.type,
        source: options.source,
        environment: environment,
        description: description || '',
        tags
      });

      console.log(chalk.green(`\n✓ Skill "${skillName}" added to ${environment} environment.\n`));
    }
  } catch (error) {
    logger.error(`Failed to add skill: ${error}`);
    process.exit(1);
  }
}
