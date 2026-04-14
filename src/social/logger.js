// ThermaShift — Simple file + console logger for the social poster
// No external dependencies

import fs from 'node:fs';
import path from 'node:path';
import { logging } from './config.js';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[logging.level] ?? LEVELS.info;

function ensureLogDir() {
  if (!fs.existsSync(logging.dir)) {
    fs.mkdirSync(logging.dir, { recursive: true });
  }
}

function formatTimestamp() {
  return new Date().toISOString();
}

function getLogFilePath() {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(logging.dir, `social-${date}.log`);
}

function writeToFile(line) {
  try {
    ensureLogDir();
    fs.appendFileSync(getLogFilePath(), line + '\n', 'utf8');
  } catch {
    // Silently fail on file write errors — still logs to console
  }
}

/**
 * Create a namespaced logger.
 * @param {string} namespace — e.g. 'linkedin', 'poster', 'scheduler'
 */
export function createLogger(namespace) {
  function log(level, ...args) {
    if (LEVELS[level] < currentLevel) return;
    const prefix = `[${formatTimestamp()}] [${level.toUpperCase()}] [${namespace}]`;
    const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    const line = `${prefix} ${message}`;

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }

    writeToFile(line);
  }

  return {
    debug: (...args) => log('debug', ...args),
    info: (...args) => log('info', ...args),
    warn: (...args) => log('warn', ...args),
    error: (...args) => log('error', ...args),
  };
}

export default { createLogger };
