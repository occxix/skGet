import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises for git-sync
vi.mock('fs', () => ({
  promises: {
    readdir: vi.fn().mockRejectedValue(new Error('ENOENT')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('test')),
    access: vi.fn().mockRejectedValue(new Error('ENOENT')),
    stat: vi.fn().mockResolvedValue({ mtime: new Date(), size: 100, isFile: () => true, isDirectory: () => false })
  }
}));

// Mock isomorphic-git
vi.mock('isomorphic-git', () => ({
  init: vi.fn().mockResolvedValue(undefined),
  clone: vi.fn().mockResolvedValue(undefined),
  addRemote: vi.fn().mockResolvedValue(undefined),
  fetch: vi.fn().mockResolvedValue(undefined),
  statusMatrix: vi.fn().mockResolvedValue([]),
  resolveRef: vi.fn().mockRejectedValue(new Error('not found')),
  add: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue('abc123'),
  pull: vi.fn().mockResolvedValue(undefined),
  push: vi.fn().mockResolvedValue(undefined),
  isDescendent: vi.fn().mockResolvedValue(false),
  readBlob: vi.fn().mockResolvedValue({ blob: new Uint8Array([1, 2, 3]) }),
  hash: vi.fn().mockRejectedValue(new Error('not implemented'))
}));

// Mock isomorphic-git/http/node
vi.mock('isomorphic-git/http/node', () => ({}));

// Mock config
const mockConfig = {
  initialized: true,
  remote: {
    url: 'https://github.com/test/repo',
    branch: 'main'
  },
  storage: {
    baseDir: '/tmp/.qcli-test/data',
    skillsDir: 'skills',
    knowledgeDir: 'knowledge',
    agentsDir: 'agents'
  }
};

vi.mock('../core/config.js', () => ({
  getConfigManager: vi.fn(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    getConfig: vi.fn().mockReturnValue(mockConfig),
    save: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should report error when no remote set', async () => {
    const noRemoteConfig = { ...mockConfig, remote: undefined };
    const { getConfigManager } = await import('../core/config.js');
    vi.mocked(getConfigManager).mockReturnValueOnce({
      load: vi.fn().mockResolvedValue(undefined),
      getConfig: vi.fn().mockReturnValue(noRemoteConfig),
      save: vi.fn(),
      set: vi.fn()
    });

    const { getSyncService, resetSyncService } = await import('../core/sync-service.js');
    resetSyncService();

    const svc = await getSyncService();
    const result = await svc.push();

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('REMOTE_NOT_CONFIGURED');

    resetSyncService();
  });

  it('should export SyncService class with expected methods', async () => {
    const { SyncService } = await import('../core/sync-service.js');
    const svc = new SyncService();

    expect(typeof svc.init).toBe('function');
    expect(typeof svc.push).toBe('function');
    expect(typeof svc.pull).toBe('function');
    expect(typeof svc.sync).toBe('function');
    expect(typeof svc.status).toBe('function');
    expect(typeof svc.resolve).toBe('function');
  });
});

describe('Environment filtering', () => {
  it('should filter files by environment', async () => {
    const { filterByEnvironments } = await import('../core/sync-service.js');
    const files = [
      'skills/claude/test/SKILL.md',
      'skills/cursor/other/SKILL.md',
      'knowledge/claude/doc1.md',
      'agents/claude/agent1/config.json',
      'skills/qwen/test.md',
      'index.json'
    ];

    const filtered = filterByEnvironments(files, ['claude']);
    expect(filtered).toEqual([
      'skills/claude/test/SKILL.md',
      'knowledge/claude/doc1.md',
      'agents/claude/agent1/config.json'
    ]);
  });

  it('should filter files by multiple environments', async () => {
    const { filterByEnvironments } = await import('../core/sync-service.js');
    const files = [
      'skills/claude/a.md',
      'skills/cursor/b.md',
      'skills/qwen/c.md'
    ];

    const filtered = filterByEnvironments(files, ['claude', 'cursor']);
    expect(filtered).toEqual([
      'skills/claude/a.md',
      'skills/cursor/b.md'
    ]);
  });

  it('should return all files when no environment specified', async () => {
    const { filterByEnvironments } = await import('../core/sync-service.js');
    const files = ['skills/claude/a.md', 'skills/cursor/b.md'];
    expect(filterByEnvironments(files, [])).toEqual(files);
  });
});

describe('ConflictInfo type', () => {
  it('should define expected fields', async () => {
    const { ConflictInfo } = await import('../types/index.js');
    const info: ConflictInfo = {
      file: 'skills/claude/test/SKILL.md',
      resourceType: 'skill',
      environment: 'claude',
      type: 'both-modified',
      localChecksum: 'abc123',
      remoteChecksum: 'def456',
      localModifiedAt: '2026-04-09T10:00:00Z',
      remoteModifiedAt: '2026-04-09T11:00:00Z',
      localSize: 1024,
      remoteSize: 2048,
      localExists: true,
      remoteExists: true
    };
    expect(info.file).toBe('skills/claude/test/SKILL.md');
    expect(info.type).toBe('both-modified');
  });
});

describe('SyncResult type', () => {
  it('should define expected structure', async () => {
    const { SyncResult } = await import('../types/index.js');
    const result: SyncResult = {
      success: true,
      action: 'push',
      environments: ['claude', 'cursor'],
      summary: {
        filesAdded: 1,
        filesModified: 2,
        filesDeleted: 0,
        conflictsCount: 0
      },
      conflicts: [],
      errors: [],
      syncedAt: new Date().toISOString()
    };
    expect(result.success).toBe(true);
    expect(result.summary.filesAdded).toBe(1);
  });
});

describe('Config migration', () => {
  it('should migrate old remotes.public to new remote field', async () => {
    const { migrateConfig } = await import('../core/migration.js');
    const oldConfig: any = {
      version: '1.0.0',
      initialized: true,
      remotes: {
        public: { url: 'https://github.com/test/public', branch: 'main', enabled: true }
      }
    };

    const migrated = await migrateConfig(oldConfig);
    expect(migrated.remote).toEqual({ url: 'https://github.com/test/public', branch: 'main' });
  });

  it('should prefer private over public', async () => {
    const { migrateConfig } = await import('../core/migration.js');
    const oldConfig: any = {
      version: '1.0.0',
      initialized: true,
      remotes: {
        public: { url: 'https://github.com/test/public', branch: 'main', enabled: true },
        private: { url: 'https://github.com/test/private', branch: 'main', enabled: true }
      }
    };

    const migrated = await migrateConfig(oldConfig);
    expect(migrated.remote?.url).toBe('https://github.com/test/private');
  });

  it('should skip if already migrated', async () => {
    const { migrateConfig } = await import('../core/migration.js');
    const config: any = {
      remote: { url: 'https://github.com/test/already', branch: 'main' },
      remotes: { public: { url: 'https://github.com/test/old', branch: 'main', enabled: true } }
    };

    const migrated = await migrateConfig(config);
    expect(migrated.remote?.url).toBe('https://github.com/test/already');
  });
});
