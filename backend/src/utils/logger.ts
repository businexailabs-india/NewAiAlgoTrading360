import winston from 'winston';
import path from 'path';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

function safeMeta(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta, (_key, value) => {
      if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack };
      }
      if (value && typeof value === 'object') {
        const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
        if (ctor && /Socket|ClientRequest|IncomingMessage|Agent|TLSSocket/.test(ctor)) {
          return `[${ctor}]`;
        }
      }
      return value;
    });
  } catch {
    return '[unserializable meta]';
  }
}

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    const { service, ...rest } = meta as Record<string, unknown>;
    if (Object.keys(rest).length > 0) {
      msg += ` ${safeMeta({ service, ...rest })}`;
    } else if (service) {
      msg += ` ${safeMeta({ service })}`;
    }
    return msg;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'smarttrade-backend' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: consoleFormat
    }),
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// If we're not in production, log to the console with colors
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

export default logger;
