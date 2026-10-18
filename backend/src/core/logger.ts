export interface Logger {
  info(fields: Record<string, unknown>): void;
  warn(fields: Record<string, unknown>): void;
  error(fields: Record<string, unknown>): void;
}

const sensitiveField =
  /authorization|cookie|token|password|secret|phone|name|email|ip|fingerprint|device|session/i;

function redact(value: unknown, key = ''): unknown {
  if (sensitiveField.test(key)) {
    return '[REDACTED]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redact(childValue, childKey)
      ])
    );
  }

  return value;
}

function write(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>): void {
  const entry = JSON.stringify(redact({ level, ...fields }));

  if (level === 'error') {
    console.error(entry);
  } else if (level === 'warn') {
    console.warn(entry);
  } else {
    console.info(entry);
  }
}

export function createLogger(): Logger {
  return {
    info: (fields) => write('info', fields),
    warn: (fields) => write('warn', fields),
    error: (fields) => write('error', fields)
  };
}
