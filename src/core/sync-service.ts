import { join } from 'path';
import { GitSync, isGitRepo, getToken } from './git-sync.js';
import { migrateConfig } from './migration.js';
import { getConfigManager } from './config.js';
import type { Config, AIEnvironment, SyncResult, SyncStatus, ConflictInfo, ConflictResolution } from '../types/index.js';
import { expandPath } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

const ALL_ENVIRONMENTS: AIEnvironment[] = ['claude', 'cursor', 'qwen', 'codex', 'codebuddy', 'common'];
const RESOURCE_DIRS = ['skills', 'knowledge', 'agents'];

export interface SyncOptions {
  environments?: AIEnvironment[];
  json?: boolean;
  dryRun?: boolean;
  force?: boolean;
  strategy?: 'local-first' | 'remote-first';
}

/** Build path prefixes for the given environments, e.g. ['skills/claude/', 'knowledge/claude/', ...] */
function buildEnvPrefixes(environments: AIEnvironment[]): string[] {
  return environments.flatMap(env => RESOURCE_DIRS.map(dir => `${dir}/${env}/`));
}

/** Check if a file path belongs to any of the given environment prefixes */
function matchesEnvPrefix(filepath: string, prefixes: string[]): boolean {
  return prefixes.some(prefix => filepath.startsWith(prefix));
}

/** Filter file lists to only include files matching the env prefixes (or index.json if all envs) */
export function filterByEnvironments(files: string[], environments: AIEnvironment[]): string[] {
  if (!environments || environments.length === 0) return files;
  const prefixes = buildEnvPrefixes(environments);
  return files.filter(f => matchesEnvPrefix(f, prefixes));
}

export class SyncService {
  private config!: Config;
  private dataDir: string = '';
  private gitSync: GitSync | null = null;

  async init(): Promise<void> {
    const configManager = getConfigManager();
    await configManager.load();
    this.config = await migrateConfig(configManager.getConfig()!);
    this.dataDir = expandPath(this.config.storage.baseDir);
  }

  private ensureGitSync(): GitSync {
    if (!this.config.remote?.url) {
      throw new Error('REMOTE_NOT_CONFIGURED: No remote configured. Run: qskills config set remote.url <url>');
    }
    if (!this.gitSync) {
      const token = (process.env.QSKILLS_TOKEN || undefined) as string | undefined;
      this.gitSync = new GitSync({
        dir: this.dataDir,
        url: this.config.remote.url,
        branch: this.config.remote.branch || 'main',
        token: token as string | undefined
      });
    }
    return this.gitSync;
  }

  // ==========================================
  // Core operations
  // ==========================================

  /** Ensure repo is initialized and connected to remote */
  async ensureRepo(): Promise<void> {
    const gs = this.ensureGitSync();
    await gs.ensureRepo(this.config.remote!.url, this.config.remote!.branch || 'main');
  }

  /** Push local changes to remote */
  async push(options: SyncOptions = {}): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      action: 'push',
      environments: options.environments || ALL_ENVIRONMENTS,
      summary: { filesAdded: 0, filesModified: 0, filesDeleted: 0, conflictsCount: 0 },
      errors: [],
      syncedAt: new Date().toISOString()
    };

    try {
      const gs = this.ensureGitSync();

      // Check if already a git repo
      if (!await isGitRepo(this.dataDir)) {
        await this.ensureRepo();
      }

      // Check for changes
      const status = await gs.getStatus();
      let modified = status.modified;
      let untracked = status.untracked;

      // Filter by environment if specified
      if (options.environments && options.environments.length > 0) {
        modified = filterByEnvironments(modified, options.environments);
        untracked = filterByEnvironments(untracked, options.environments);
      }

      const hasChanges = modified.length > 0 || untracked.length > 0;

      if (!hasChanges) {
        result.success = true;
        return result;
      }

      // Check ahead/behind before push
      try {
        const ab = await gs.getAheadBehind();
        if (ab.behind > 0) {
          result.errors.push({
            code: 'PUSH_REJECTED',
            message: 'Remote has newer commits. Run `qskills sync --pull` first.'
          });
          return result;
        }
      } catch {
        // First push, no tracking branch yet
      }

      if (options.dryRun) {
        result.summary.filesModified = modified.length;
        result.summary.filesAdded = untracked.length;
        return result;
      }

      // Commit and push (only filtered files)
      const envLabel = options.environments?.length ? ` [${options.environments.join(',')}]` : '';
      const message = `sync: push${envLabel} ${new Date().toISOString()}`;
      const sha = await gs.commit(message, [...modified, ...untracked]);

      if (!sha) {
        result.errors.push({ code: 'COMMIT_FAILED', message: 'Failed to commit changes' });
        return result;
      }

      await gs.push();

      result.success = true;
      result.commitSha = sha;
      result.summary.filesModified = modified.length;
      result.summary.filesAdded = untracked.length;
      result.syncedAt = new Date().toISOString();

      logger.debug(`Push successful: ${sha}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({ code: 'PUSH_ERROR', message: errMsg });
      logger.error(`Push failed: ${errMsg}`);
    }

    return result;
  }

  /** Pull changes from remote */
  async pull(options: SyncOptions = {}): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      action: 'pull',
      environments: options.environments || ALL_ENVIRONMENTS,
      summary: { filesAdded: 0, filesModified: 0, filesDeleted: 0, conflictsCount: 0 },
      errors: [],
      syncedAt: new Date().toISOString()
    };

    try {
      const gs = this.ensureGitSync();

      // If not a git repo, clone
      if (!await isGitRepo(this.dataDir)) {
        if (options.dryRun) {
          result.errors.push({ code: 'DRY_RUN', message: 'Would clone remote repository' });
          return result;
        }
        await gs.clone();
        result.success = true;
        result.summary.filesAdded = 1;
        return result;
      }

      // Fetch
      await gs.fetch();

      // Check if behind
      const ab = await gs.getAheadBehind();
      if (ab.behind === 0) {
        result.success = true;
        return result;
      }

      if (options.dryRun) {
        result.summary.filesModified = ab.behind;
        return result;
      }

      // Merge (ff first, then merge if needed)
      const mergeResult = await gs.merge();

      if (!mergeResult.success && mergeResult.mergeConflicts.length > 0) {
        // Collect conflict details (filtered by environment if specified)
        let conflictFiles = mergeResult.mergeConflicts;
        if (options.environments && options.environments.length > 0) {
          conflictFiles = filterByEnvironments(conflictFiles, options.environments);
        }

        const conflicts: ConflictInfo[] = [];
        for (const file of conflictFiles) {
          conflicts.push({
            file,
            resourceType: this.inferResourceType(file),
            environment: this.inferEnvironment(file),
            type: 'both-modified',
            localChecksum: await gs.getFileChecksum(file),
            remoteChecksum: '',
            localModifiedAt: await gs.getFileModifiedTime(file),
            remoteModifiedAt: '',
            localSize: await gs.getFileSize(file),
            remoteSize: 0,
            localExists: await gs.fileExists(file),
            remoteExists: true
          });
        }

        result.conflicts = conflicts;
        result.summary.conflictsCount = conflicts.length;

        // Apply force strategy if specified
        if (options.force || options.strategy === 'remote-first') {
          for (const conflict of conflicts) {
            await gs.resolveMergeConflict(conflict.file, 'theirs');
          }
          await gs.commit(`sync: resolve conflicts (remote-first) ${new Date().toISOString()}`);
          result.success = true;
          result.conflicts = [];
          result.summary.conflictsCount = 0;
        }

        return result;
      }

      result.success = true;
      result.summary.filesModified = ab.behind;
      result.syncedAt = new Date().toISOString();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('ENOTFOUND') || errMsg.includes('network') || errMsg.includes('connect')) {
        result.errors.push({ code: 'NETWORK_ERROR', message: errMsg });
      } else if (errMsg.includes('auth') || errMsg.includes('401') || errMsg.includes('403')) {
        result.errors.push({ code: 'AUTH_FAILED', message: 'Authentication failed. Check your Git credentials.' });
      } else {
        result.errors.push({ code: 'PULL_ERROR', message: errMsg });
      }
      logger.error(`Pull failed: ${errMsg}`);
    }

    return result;
  }

  /** Bidirectional sync (pull then push) */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    // Step 1: Pull
    const pullResult = await this.pull(options);

    if (!pullResult.success) {
      // Return pull result with conflicts
      pullResult.action = 'sync';
      return pullResult;
    }

    // Step 2: Push
    const pushResult = await this.push(options);
    pushResult.action = 'sync';

    // Merge summaries
    pushResult.summary = {
      filesAdded: pullResult.summary.filesAdded + pushResult.summary.filesAdded,
      filesModified: pullResult.summary.filesModified + pushResult.summary.filesModified,
      filesDeleted: pullResult.summary.filesDeleted + pushResult.summary.filesDeleted,
      conflictsCount: 0
    };

    return pushResult;
  }

  /** Get sync status */
  async status(options?: SyncOptions): Promise<SyncStatus> {
    const status: SyncStatus = {
      remoteConfigured: !!this.config.remote?.url,
      remoteUrl: this.config.remote?.url,
      branch: this.config.remote?.branch || 'main',
      isGitRepo: false,
      connected: false,
      ahead: 0,
      behind: 0,
      modified: [],
      untracked: [],
      lastSync: null
    };

    if (!status.remoteConfigured) return status;

    status.isGitRepo = await isGitRepo(this.dataDir);
    if (!status.isGitRepo) return status;

    try {
      const gs = this.ensureGitSync();
      const repoStatus = await gs.getStatus();
      const ab = await gs.getAheadBehind();

      let modified = repoStatus.modified;
      let untracked = repoStatus.untracked;

      // Filter by environment if specified
      if (options?.environments && options.environments.length > 0) {
        modified = filterByEnvironments(modified, options.environments);
        untracked = filterByEnvironments(untracked, options.environments);
      }

      status.ahead = ab.ahead;
      status.behind = ab.behind;
      status.modified = modified;
      status.untracked = untracked;
      status.connected = true;
    } catch {
      status.connected = false;
    }

    return status;
  }

  /** Resolve conflicts */
  async resolve(resolutions: ConflictResolution[]): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      action: 'resolve',
      summary: { filesAdded: 0, filesModified: 0, filesDeleted: 0, conflictsCount: 0 },
      errors: [],
      syncedAt: new Date().toISOString()
    };

    try {
      const gs = this.ensureGitSync();

      for (const r of resolutions) {
        if (r.resolution === 'skip') continue;
        if (r.resolution === 'keep-remote') {
          await gs.resolveMergeConflict(r.file, 'theirs');
        } else {
          await gs.resolveMergeConflict(r.file, 'ours');
        }
        result.summary.filesModified++;
      }

      await gs.commit(`sync: resolve ${resolutions.length} conflict(s) ${new Date().toISOString()}`);
      result.success = true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({ code: 'RESOLVE_ERROR', message: errMsg });
    }

    return result;
  }

  // ==========================================
  // Helpers
  // ==========================================

  private inferResourceType(file: string): ConflictInfo['resourceType'] {
    if (file.startsWith('skills/')) return 'skill';
    if (file.startsWith('knowledge/')) return 'knowledge';
    if (file.startsWith('agents/')) return 'agent';
    if (file === 'index.json') return 'index';
    return 'unknown';
  }

  private inferEnvironment(file: string): AIEnvironment | undefined {
    const parts = file.split('/');
    if (parts.length >= 2) {
      const env = parts[1] as AIEnvironment;
      if (ALL_ENVIRONMENTS.includes(env)) return env;
    }
    return undefined;
  }
}

let _instance: SyncService | null = null;

export async function getSyncService(): Promise<SyncService> {
  if (!_instance) {
    _instance = new SyncService();
    await _instance.init();
  }
  return _instance;
}

export function resetSyncService(): void {
  _instance = null;
}
