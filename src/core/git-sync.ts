import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import * as fs from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { expandPath } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import type { RepoStatus } from '../types/index.js';

export interface GitSyncOptions {
  dir: string;
  url: string;
  branch?: string;
  token?: string;
}

export class GitSync {
  private dir: string;
  private url: string;
  private branch: string;
  private token?: string;

  constructor(options: GitSyncOptions) {
    this.dir = expandPath(options.dir);
    this.url = options.url;
    this.branch = options.branch || 'main';
    this.token = options.token;
  }

  private getAuth() {
    if (!this.token) return undefined;
    return {
      username: this.token,
      password: 'x-oauth-basic'
    };
  }

  // ==========================================
  // Original methods (backward compatible)
  // ==========================================

  async initRepo(): Promise<void> {
    try {
      await git.init({ fs, dir: this.dir, defaultBranch: this.branch });
      logger.debug(`Initialized git repository at ${this.dir}`);
    } catch (error) {
      logger.error(`Failed to init repo: ${error}`);
      throw error;
    }
  }

  async clone(): Promise<void> {
    try {
      await git.clone({
        fs, http, dir: this.dir, url: this.url, ref: this.branch,
        onAuth: () => this.getAuth(), singleBranch: true, depth: 1
      });
      logger.debug(`Cloned ${this.url} to ${this.dir}`);
    } catch (error) {
      logger.error(`Failed to clone repo: ${error}`);
      throw error;
    }
  }

  async commit(message: string): Promise<string | null> {
    try {
      const status = await this.getStatus();
      for (const file of [...status.modified, ...status.untracked]) {
        await git.add({ fs, dir: this.dir, filepath: file });
      }
      const sha = await git.commit({
        fs, dir: this.dir, message,
        author: { name: 'qskills', email: 'qskills@local' }
      });
      logger.debug(`Committed: ${sha}`);
      return sha;
    } catch (error) {
      logger.error(`Failed to commit: ${error}`);
      return null;
    }
  }

  async push(): Promise<void> {
    try {
      await git.push({
        fs, http, dir: this.dir, ref: this.branch,
        onAuth: () => this.getAuth()
      });
      logger.debug(`Pushed changes to ${this.url}`);
    } catch (error) {
      logger.error(`Failed to push: ${error}`);
      throw error;
    }
  }

  async getStatus(): Promise<RepoStatus> {
    const status: RepoStatus = {
      ahead: 0, behind: 0, modified: [], untracked: [], staged: []
    };
    try {
      const files = await git.statusMatrix({ fs, dir: this.dir });
      for (const [filepath, head, workdir, stage] of files) {
        if (head === 1 && workdir === 2 && stage === 2) status.staged.push(filepath);
        else if (head === 1 && workdir === 2) status.modified.push(filepath);
        else if (head === 0 && workdir === 1) status.untracked.push(filepath);
      }
      status.ahead = status.staged.length + status.modified.length > 0 ? 1 : 0;
    } catch (error) {
      logger.debug(`Failed to get status: ${error}`);
    }
    return status;
  }

  async hasChanges(): Promise<boolean> {
    const status = await this.getStatus();
    return status.modified.length > 0 || status.untracked.length > 0;
  }

  async addRemotes(remotes: { name: string; url: string }[]): Promise<void> {
    for (const remote of remotes) {
      try {
        await git.addRemote({ fs, dir: this.dir, remote: remote.name, url: remote.url });
      } catch {
        logger.debug(`Remote ${remote.name} may already exist`);
      }
    }
  }

  async fetch(remoteName: string = 'origin'): Promise<void> {
    try {
      await git.fetch({
        fs, http, dir: this.dir, remote: remoteName,
        onAuth: () => this.getAuth()
      });
      logger.debug(`Fetched from ${remoteName}`);
    } catch (error) {
      logger.error(`Failed to fetch: ${error}`);
      throw error;
    }
  }

  // ==========================================
  // New methods (sync enhancement)
  // ==========================================

  async getCurrentCommit(): Promise<string | null> {
    try {
      return await git.resolveRef({ fs, dir: this.dir, ref: 'HEAD' }) || null;
    } catch { return null; }
  }

  async getRemoteCommit(): Promise<string | null> {
    try {
      return await git.resolveRef({ fs, dir: this.dir, ref: `refs/remotes/origin/${this.branch}` }) || null;
    } catch { return null; }
  }

  async getAheadBehind(): Promise<{ ahead: number; behind: number }> {
    try {
      const localOid = await this.getCurrentCommit();
      const remoteOid = await this.getRemoteCommit();
      if (!localOid || !remoteOid) return { ahead: 0, behind: 0 };
      if (localOid === remoteOid) return { ahead: 0, behind: 0 };

      const isAncestor = await git.isDescendent({
        fs, dir: this.dir, oid: remoteOid, ancestor: localOid
      }).catch(() => false);
      const isDescendant = await git.isDescendent({
        fs, dir: this.dir, oid: localOid, ancestor: remoteOid
      }).catch(() => false);

      if (isAncestor) return { ahead: 0, behind: 1 };
      if (isDescendant) return { ahead: 1, behind: 0 };
      return { ahead: 1, behind: 1 };
    } catch { return { ahead: 0, behind: 0 }; }
  }

  async merge(options?: { fastForward?: boolean }): Promise<{ success: boolean; mergeConflicts: string[] }> {
    try {
      if (options?.fastForward !== false) {
        try {
          await git.pull({
            fs, http, dir: this.dir, ref: this.branch,
            onAuth: () => this.getAuth(), singleBranch: true, fastForward: true
          });
          return { success: true, mergeConflicts: [] };
        } catch { /* fall through to merge */ }
      }
      await git.pull({
        fs, http, dir: this.dir, ref: this.branch,
        onAuth: () => this.getAuth(), singleBranch: true, fastForward: false
      });
      return { success: true, mergeConflicts: [] };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('merge') || errMsg.includes('conflict')) {
        return { success: false, mergeConflicts: await this.getConflicts() };
      }
      throw error;
    }
  }

  async getConflicts(): Promise<string[]> {
    const conflicts: string[] = [];
    try {
      const files = await git.statusMatrix({ fs, dir: this.dir });
      for (const [filepath, head, workdir, stage] of files) {
        if (stage !== 0 && head !== workdir && stage !== workdir) {
          conflicts.push(filepath);
        }
      }
    } catch { /* ignore */ }
    return conflicts;
  }

  async resolveMergeConflict(filepath: string, strategy: 'ours' | 'theirs'): Promise<void> {
    try {
      if (strategy === 'theirs') {
        const content = await this.readFile(filepath, `origin/${this.branch}`);
        if (content) {
          await fs.promises.writeFile(join(this.dir, filepath), content);
        }
      }
      await git.add({ fs, dir: this.dir, filepath });
    } catch (error) {
      logger.error(`Failed to resolve conflict for ${filepath}: ${error}`);
      throw error;
    }
  }

  async readFile(filepath: string, ref?: string): Promise<Uint8Array | null> {
    try {
      const result = await git.readBlob({ fs, dir: this.dir, filepath, oid: ref || '' });
      if (result && result.blob) {
        return result.blob as Uint8Array;
      }
      return null;
    } catch { return null; }
  }

  async getFileChecksum(filepath: string): Promise<string> {
    try {
      const content = await fs.promises.readFile(join(this.dir, filepath));
      return createHash('sha1').update(content).digest('hex');
    } catch { return ''; }
  }

  async getFileModifiedTime(filepath: string): Promise<string> {
    try { return (await fs.promises.stat(join(this.dir, filepath))).mtime.toISOString(); }
    catch { return ''; }
  }

  async getFileSize(filepath: string): Promise<number> {
    try { return (await fs.promises.stat(join(this.dir, filepath))).size; }
    catch { return 0; }
  }

  async fileExists(filepath: string): Promise<boolean> {
    try { await fs.promises.access(join(this.dir, filepath)); return true; }
    catch { return false; }
  }

  async ensureRepo(remoteUrl: string, branch: string): Promise<void> {
    if (!(await isGitRepo(this.dir))) {
      await this.initRepo();
    }
    await this.addRemotes([{ name: 'origin', url: remoteUrl }]);

    const gitignorePath = join(this.dir, '.gitignore');
    try { await fs.promises.access(gitignorePath); }
    catch {
      await fs.promises.writeFile(gitignorePath,
        '*.tmp\n*.log\n*.bak\n.DS_Store\nThumbs.db\n.vscode/\n.idea/\n');
    }

    const gitattrPath = join(this.dir, '.gitattributes');
    try { await fs.promises.access(gitattrPath); }
    catch {
      await fs.promises.writeFile(gitattrPath, '* text=auto eol=lf\n');
    }
  }
}

// ==========================================
// Helper functions
// ==========================================

export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await fs.promises.readdir(join(expandPath(dir), '.git'));
    return true;
  } catch { return false; }
}

export async function getToken(): Promise<string | null> {
  return process.env.QSKILLS_TOKEN || null;
}

export async function setToken(token: string): Promise<void> {
  process.env.QSKILLS_TOKEN = token;
}
