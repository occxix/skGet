import { getStorage } from '../../core/storage.js';
import { logger } from '../../utils/logger.js';
import type { AIEnvironment } from '../../types/index.js';

export async function listAgents(
  options: {
    env?: AIEnvironment;
    source?: 'public' | 'private' | 'builtin';
    tags?: string;
    json?: boolean;
  }
): Promise<void> {
  try {
    const storage = await getStorage();

    const agents = await storage.listAgents({
      environment: options.env,
      source: options.source,
      tags: options.tags ? options.tags.split(',').map(t => t.trim()) : undefined
    });

    if (options.json) {
      console.log(JSON.stringify(agents, null, 2));
      return;
    }

    if (agents.length === 0) {
      logger.info('No agents found');
      return;
    }

    console.log('\nAgents:\n');

    // 按环境分组
    const byEnv: Record<string, typeof agents> = {};
    for (const agent of agents) {
      const env = agent.environment;
      if (!byEnv[env]) byEnv[env] = [];
      byEnv[env].push(agent);
    }

    for (const [env, envAgents] of Object.entries(byEnv)) {
      console.log(`  [${env}]`);
      for (const agent of envAgents) {
        console.log(`    - ${agent.name} (${agent.version})`);
        if (agent.description) {
          console.log(`      ${agent.description}`);
        }
        if (agent.tags.length > 0) {
          console.log(`      Tags: ${agent.tags.join(', ')}`);
        }
      }
      console.log();
    }

    console.log(`Total: ${agents.length} agent(s)\n`);
  } catch (error) {
    logger.fail(`Failed to list agents: ${(error as Error).message}`);
    process.exit(1);
  }
}
