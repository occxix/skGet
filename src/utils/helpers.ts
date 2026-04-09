import { randomUUID } from 'crypto';

export function generateId(): string {
  return randomUUID();
}

export function expandPath(path: string): string {
  if (path.startsWith('~')) {
    return path.replace('~', process.env.HOME || process.env.USERPROFILE || '');
  }
  return path;
}

export function validateName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0 && name.length <= 64;
}

export function sanitizeTags(tags: string): string[] {
  return tags
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0);
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}
