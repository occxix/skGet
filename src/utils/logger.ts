import chalk from 'chalk';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  const prefix: Record<LogLevel, string> = {
    debug: chalk.gray('[DEBUG]'),
    info: chalk.blue('[INFO]'),
    warn: chalk.yellow('[WARN]'),
    error: chalk.red('[ERROR]')
  };
  return `${prefix[level]} ${message}`;
}

export const logger = {
  debug(message: string): void {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.debug) {
      console.error(formatMessage('debug', message));
    }
  },
  info(message: string): void {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.info) {
      console.log(formatMessage('info', message));
    }
  },
  warn(message: string): void {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message));
    }
  },
  error(message: string): void {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.error) {
      console.error(formatMessage('error', message));
    }
  },
  success(message: string): void {
    console.log(chalk.green('✓') + ' ' + message);
  },
  fail(message: string): void {
    console.log(chalk.red('✗') + ' ' + message);
  }
};
