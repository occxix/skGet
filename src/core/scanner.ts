import type { SecretFinding, ScanResult, CustomScanRule } from '../types/index.js';

// 内置敏感信息检测规则
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; severity: 'high' | 'medium' | 'low' }> = [
  { name: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/g, severity: 'high' },
  { name: 'aws-secret-key', pattern: /aws(.{0,20})?['"][0-9a-zA-Z\/+=]{40}['"]/gi, severity: 'high' },
  { name: 'github-token', pattern: /ghp_[a-zA-Z0-9]{36}/g, severity: 'high' },
  { name: 'github-oauth', pattern: /gho_[a-zA-Z0-9]{36}/g, severity: 'high' },
  { name: 'github-app-token', pattern: /(ghu|ghs)_[a-zA-Z0-9]{36}/g, severity: 'high' },
  { name: 'private-key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, severity: 'high' },
  { name: 'api-key-generic', pattern: /(api[_-]?key|apikey|secret[_-]?key|access[_-]?key)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{20,}['"]?/gi, severity: 'medium' },
  { name: 'password-in-code', pattern: /(password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi, severity: 'medium' },
  { name: 'jwt-token', pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, severity: 'medium' },
  { name: 'slack-token', pattern: /xox[baprs]-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}/g, severity: 'high' },
  { name: 'google-api-key', pattern: /AIza[0-9A-Za-z\-_]{35}/g, severity: 'high' },
  { name: 'stripe-key', pattern: /sk_live_[0-9a-zA-Z]{24}/g, severity: 'high' },
  { name: 'database-url', pattern: /(mysql|postgres|mongodb|redis):\/\/[^:]+:[^@]+@[^\s]+/gi, severity: 'high' },
  { name: 'env-file-secrets', pattern: /\.env(\.local|\.production)?/g, severity: 'low' },
];

export class Scanner {
  private patterns: Array<{ name: string; pattern: RegExp; severity: 'high' | 'medium' | 'low' }>;
  private skipPatterns: RegExp[];
  private customPatterns: CustomScanRule[];

  constructor(options?: { skipPatterns?: string[]; customPatterns?: CustomScanRule[] }) {
    this.patterns = [...SECRET_PATTERNS];
    this.skipPatterns = (options?.skipPatterns || []).map(p => this.globToRegex(p));
    this.customPatterns = options?.customPatterns || [];

    // 添加自定义规则
    for (const rule of this.customPatterns) {
      this.patterns.push({
        name: rule.name,
        pattern: new RegExp(rule.pattern, 'g'),
        severity: rule.severity
      });
    }
  }

  private globToRegex(glob: string): RegExp {
    const regex = glob
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\./g, '\\.');
    return new RegExp(regex);
  }

  private shouldSkip(filePath: string): boolean {
    return this.skipPatterns.some(pattern => pattern.test(filePath));
  }

  async scanContent(content: string, filePath: string): Promise<ScanResult> {
    if (this.shouldSkip(filePath)) {
      return { hasSecrets: false, findings: [] };
    }

    const findings: SecretFinding[] = [];

    for (const { name, pattern, severity } of this.patterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        // 计算行号
        const beforeMatch = content.substring(0, match.index);
        const line = beforeMatch.split('\n').length;

        findings.push({
          file: filePath,
          line,
          type: name,
          match: this.maskSecret(match[0]),
          severity
        });
      }
    }

    return {
      hasSecrets: findings.length > 0,
      findings
    };
  }

  async scanFiles(files: Map<string, string>): Promise<ScanResult> {
    const allFindings: SecretFinding[] = [];

    for (const [filePath, content] of files) {
      const result = await this.scanContent(content, filePath);
      allFindings.push(...result.findings);
    }

    return {
      hasSecrets: allFindings.length > 0,
      findings: allFindings
    };
  }

  async scanDirectory(filePaths: string[], readFile: (path: string) => Promise<string>): Promise<ScanResult> {
    const allFindings: SecretFinding[] = [];

    for (const filePath of filePaths) {
      if (this.shouldSkip(filePath)) continue;

      try {
        const content = await readFile(filePath);
        const result = await this.scanContent(content, filePath);
        allFindings.push(...result.findings);
      } catch {
        // 忽略无法读取的文件
      }
    }

    return {
      hasSecrets: allFindings.length > 0,
      findings: allFindings
    };
  }

  private maskSecret(secret: string): string {
    if (secret.length <= 8) {
      return '*'.repeat(secret.length);
    }
    return secret.substring(0, 4) + '*'.repeat(secret.length - 8) + secret.substring(secret.length - 4);
  }

  getPatternNames(): string[] {
    return this.patterns.map(p => p.name);
  }

  addPattern(pattern: { name: string; pattern: string; severity: 'high' | 'medium' | 'low' }): void {
    this.patterns.push({
      name: pattern.name,
      pattern: new RegExp(pattern.pattern, 'g'),
      severity: pattern.severity
    });
  }
}

// 单例
let scannerInstance: Scanner | null = null;

export function getScanner(options?: { skipPatterns?: string[]; customPatterns?: CustomScanRule[] }): Scanner {
  if (!scannerInstance) {
    scannerInstance = new Scanner(options);
  }
  return scannerInstance;
}
