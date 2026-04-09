import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import * as fs from 'fs';
import { join } from 'path';
import { expandPath } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import type { SyncResult, RepoStatus } from '../types/index.js';

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

  async initRepo(): Promise<void> {
    try {
      await git.init({
        fs,
        dir: this.dir,
        defaultBranch: this.branch
      });

      logger.debug(`Initialized git repository at ${this.dir}`);
    } catch (error) {
      logger.error(`Failed to init repo: ${error}`);
      throw error;
    }
  }

  async clone(): Promise<void> {
    try {
      await git.clone({
        fs,
        http,
        dir: this.dir,
        url: this.url,
        ref: this.branch,
        onAuth: () => this.getAuth(),
        singleBranch: true,
        depth: 1
      });

      logger.debug(`Cloned ${this.url} to ${this.dir}`);
    } catch (error) {
      logger.error(`Failed to clone repo: ${error}`);
      throw error;
    }
  }

  async pull(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      pulled: 0,
      pushed: 0,
      conflicts: [],
      errors: []
    };

    try {
      const status = await this.getStatus();

      if (status.modified.length > 0 || status.staged.length > 0) {
        result.conflicts = [...status.modified, ...status.staged];
        result.errors.push('Local changes detected. Please commit or stash first.');
        return result;
      }

      await git.pull({
        fs,
        http,
        dir: this.dir,
        ref: this.branch,
        onAuth: () => this.getAuth(),
        singleBranch: true,
        fastForward: true
      });

      result.pulled = 1;
      result.success = true;
      logger.debug(`Pulled changes from ${this.url}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      logger.error(`Failed to pull: ${errorMessage}`);
    }

    return result;
  }

  async push(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      pulled: 0,
      pushed: 0,
      conflicts: [],
      errors: []
    };

    try {
      const status = await this.getStatus();

      if (status.ahead === 0) {
        result.success = true;
        return result;
      }

      await git.push({
        fs,
        http,
        dir: this.dir,
        ref: this.branch,
        onAuth: () => this.getAuth()
      });

      result.pushed = status.ahead;
      result.success = true;
      logger.debug(`Pushed changes to ${this.url}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      logger.error(`Failed to push: ${errorMessage}`);
    }

    return result;
  }

  async commit(message: string): Promise<string | null> {
    try {
      const status = await this.getStatus();

      for (const file of [...status.modified, ...status.untracked]) {
        await git.add({
          fs,
          dir: this.dir,
          filepath: file
        });
      }

      const sha = await git.commit({
        fs,
        dir: this.dir,
        message,
        author: {
          name: 'qskills',
          email: 'qskills@local'
        }
      });

      logger.debug(`Committed: ${sha}`);
      return sha;
    } catch (error) {
      logger.error(`Failed to commit: ${error}`);
      return null;
    }
  }

  async getStatus(): Promise<RepoStatus> {
    const status: RepoStatus = {
      ahead: 0,
      behind: 0,
      modified: [],
      untracked: [],
      staged: []
    };

    try {
      const files = await git.statusMatrix({
        fs,
        dir: this.dir
      });

      for (const [filepath, head, workdir, stage] of files) {
        if (head === 1 && workdir === 2 && stage === 2) {
          status.staged.push(filepath);
        } else if (head === 1 && workdir === 2) {
          status.modified.push(filepath);
        } else if (head === 0 && workdir === 1) {
          status.untracked.push(filepath);
        }
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
        await git.addRemote({
          fs,
          dir: this.dir,
          remote: remote.name,
          url: remote.url
        });
      } catch {
        logger.debug(`Remote ${remote.name} may already exist`);
      }
    }
  }

  async fetch(remoteName: string = 'origin'): Promise<void> {
    try {
      await git.fetch({
        fs,
        http,
        dir: this.dir,
        remote: remoteName,
        onAuth: () => this.getAuth()
      });

      logger.debug(`Fetched from ${remoteName}`);
    } catch (error) {
      logger.error(`Failed to fetch: ${error}`);
      throw error;
    }
  }
}

// 辅助函数
export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    const expanded = expandPath(dir);
    await fs.promises.readdir(join(expanded, '.git'));
    return true;
  } catch {
    return false;
  }
}

export async function getToken(): Promise<string | null> {
  const envToken = process.env.QSKILLS_TOKEN;
  if (envToken) return envToken;
  return null;
}

export async function setToken(token: string): Promise<void> {
  process.env.QSKILLS_TOKEN = token;
}
