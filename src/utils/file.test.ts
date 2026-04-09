import { describe, it, expect } from 'vitest';
import { computeStringHash } from '../utils/file';

describe('computeStringHash', () => {
  it('should generate consistent SHA-256 hash', async () => {
    const content = 'test content';
    const hash = await computeStringHash(content);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should generate same hash for same content', async () => {
    const content = 'same content';
    const hash1 = await computeStringHash(content);
    const hash2 = await computeStringHash(content);
    expect(hash1).toBe(hash2);
  });

  it('should generate different hash for different content', async () => {
    const hash1 = await computeStringHash('content 1');
    const hash2 = await computeStringHash('content 2');
    expect(hash1).not.toBe(hash2);
  });
});
