import { readFile, writeFile, mkdir, access, stat, readdir, copyFile, rm } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { createHash } from 'crypto';
import { logger } from './logger.js';
import { expandPath } from './helpers.js';

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(expandPath(path));
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(path: string): Promise<void> {
  const expanded = expandPath(path);
  await mkdir(expanded, { recursive: true });
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(expandPath(path), 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    logger.debug(`Failed to read JSON from ${path}: ${error}`);
    return null;
  }
}

export async function writeJson<T>(path: string, data: T): Promise<void> {
  const expanded = expandPath(path);
  await ensureDir(dirname(expanded));
  await writeFile(expanded, JSON.stringify(data, null, 2), 'utf-8');
}

export async function readFileContent(path: string): Promise<string> {
  return readFile(expandPath(path), 'utf-8');
}

export async function writeFileContent(path: string, content: string): Promise<void> {
  const expanded = expandPath(path);
  await ensureDir(dirname(expanded));
  await writeFile(expanded, content, 'utf-8');
}

export async function computeFileHash(path: string): Promise<string> {
  const content = await readFile(expandPath(path));
  return createHash('sha256').update(content).digest('hex');
}

export async function computeStringHash(content: string): Promise<string> {
  return createHash('sha256').update(content).digest('hex');
}

export async function listFiles(dir: string, pattern?: RegExp): Promise<string[]> {
  const expanded = expandPath(dir);
  const files: string[] = [];

  async function scan(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          await scan(fullPath);
        }
      } else if (entry.isFile()) {
        if (!pattern || pattern.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  }

  await scan(expanded);
  return files;
}

export async function copyDirectory(src: string, dest: string): Promise<void> {
  const srcPath = expandPath(src);
  const destPath = expandPath(dest);

  await ensureDir(destPath);

  const entries = await readdir(srcPath, { withFileTypes: true });

  for (const entry of entries) {
    const srcFull = join(srcPath, entry.name);
    const destFull = join(destPath, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcFull, destFull);
    } else {
      await copyFile(srcFull, destFull);
    }
  }
}

export async function removeDirectory(path: string): Promise<void> {
  await rm(expandPath(path), { recursive: true, force: true });
}

export async function getFileStats(path: string): Promise<{ size: number; modified: Date } | null> {
  try {
    const stats = await stat(expandPath(path));
    return {
      size: stats.size,
      modified: stats.mtime
    };
  } catch {
    return null;
  }
}

export async function isFile(path: string): Promise<boolean> {
  try {
    const stats = await stat(expandPath(path));
    return stats.isFile();
  } catch {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(expandPath(path));
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function listDirectories(dir: string): Promise<string[]> {
  const expanded = expandPath(dir);
  const dirs: string[] = [];

  try {
    const entries = await readdir(expanded, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        dirs.push(join(expanded, entry.name));
      }
    }
  } catch {
    // ignore
  }

  return dirs;
}
