import { describe, it, expect, beforeEach } from 'vitest';
import { validateName, sanitizeTags, generateId, expandPath } from '../utils/helpers';

describe('validateName', () => {
  it('should accept valid names', () => {
    expect(validateName('my-skill')).toBe(true);
    expect(validateName('my_skill')).toBe(true);
    expect(validateName('myskill123')).toBe(true);
    expect(validateName('MySkill')).toBe(true);
    expect(validateName('a')).toBe(true);
  });

  it('should reject invalid names', () => {
    expect(validateName('')).toBe(false);
    expect(validateName('my skill')).toBe(false);
    expect(validateName('my.skill')).toBe(false);
    expect(validateName('my/skill')).toBe(false);
    expect(validateName('a'.repeat(65))).toBe(false);
  });
});

describe('sanitizeTags', () => {
  it('should split and normalize tags', () => {
    expect(sanitizeTags('tag1, tag2, TAG3')).toEqual(['tag1', 'tag2', 'tag3']);
    expect(sanitizeTags('single')).toEqual(['single']);
    expect(sanitizeTags('  spaced  ,  tags  ')).toEqual(['spaced', 'tags']);
  });

  it('should handle empty input', () => {
    expect(sanitizeTags('')).toEqual([]);
    expect(sanitizeTags('   ')).toEqual([]);
  });
});

describe('generateId', () => {
  it('should generate valid UUIDs', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('expandPath', () => {
  it('should expand tilde to home directory', () => {
    const path = expandPath('~/test');
    expect(path).not.toContain('~');
    expect(path).toContain('test');
  });

  it('should return unchanged path without tilde', () => {
    const path = expandPath('/absolute/path');
    expect(path).toBe('/absolute/path');
  });
});
