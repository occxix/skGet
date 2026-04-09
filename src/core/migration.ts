import type { Config } from '../types/index.js';

/**
 * Migrate old remotes.public/private config to new single remote field.
 * Prefers private over public if both exist.
 */
export async function migrateConfig(config: Config): Promise<Config> {
  // Already migrated
  if (config.remote) return config;

  const privateRepo = config.remotes?.private;
  const publicRepo = config.remotes?.public;
  const repo = privateRepo || publicRepo;

  if (repo?.url) {
    config.remote = {
      url: repo.url,
      branch: repo.branch || 'main'
    };
    console.log(`[migration] Auto-migrated remote: ${repo.url}`);
  }

  return config;
}
