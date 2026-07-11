const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => { if (isDev) console.log(...args); },
  warn: (...args: unknown[]) => { if (isDev) console.warn(...args); },
  info: (...args: unknown[]) => { if (isDev) console.info(...args); },
  error: (...args: unknown[]) => console.error(...args), // always show errors
};
