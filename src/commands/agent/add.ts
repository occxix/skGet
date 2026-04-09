import { getStorage } from '../../core/storage.js';
import { getScanner } from '../../core/scanner.js';
import { expandPath } from '../../utils/helpers.js';
import { readFileContent } from '../../utils/file.js';
import { logger } from '../../utils/logger.js';
import type { AIEnvironment } from '../../types/index.js';

export async function addAgent(
  sourcePath: string,
  options: {
    name?: string;
    source?: 'public' | 'private' | 'builtin';
    env?: AIEnvironment;
    description?: string;
    tags?: string;
    skipScan?: boolean;
  }
): Promise<void> {
  try {
    const storage = await getStorage();

    // 验证必填参数
    if (!options.name) {
      logger.fail('Error: --name option is required');
      process.exit(1);
    }

    // 安全扫描
    if (!options.skipScan) {
      const scanner = getScanner();
      const expandedPath = expandPath(sourcePath);
      const content = await readFileContent(expandedPath);
      const result = await scanner.scanContent(content, sourcePath);

      if (result.hasSecrets) {
        logger.warn('Sensitive information detected:');
        for (const finding of result.findings) {
          logger.warn(`  [${finding.severity.toUpperCase()}] ${finding.type} in ${finding.file}:${finding.line}`);
        }

        const { confirm } = await import('@inquirer/prompts');
        const proceed = await confirm({
          message: 'Continue adding despite detected secrets?',
          default: false
        });

        if (!proceed) {
          logger.info('Operation cancelled');
          return;
        }
      }
    }

    // 添加 Agent
    const agent = await storage.addAgent(sourcePath, {
      name: options.name,
      source: options.source || 'private',
      environment: options.env || 'common',
      description: options.description,
      tags: options.tags ? options.tags.split(',').map(t => t.trim()) : []
    });

    logger.success(`Agent "${agent.name}" added successfully`);
    logger.info(`ID: ${agent.id}`);
    logger.info(`Environment: ${agent.environment}`);
  } catch (error) {
    logger.fail(`Failed to add agent: ${(error as Error).message}`);
    process.exit(1);
  }
}
