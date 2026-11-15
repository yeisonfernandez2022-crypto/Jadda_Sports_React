const logger = {
  info: (...datos) => console.log(...datos),
  warn: (...datos) => console.warn(...datos),
  error: (...datos) => console.error(...datos),
  debug: (...datos) => console.debug(...datos),
};

module.exports = logger;
