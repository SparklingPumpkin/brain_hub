export function createLogger(config) {
  return {
    info(message, extra = {}) {
      console.log(
        JSON.stringify({
          level: "info",
          timestamp: new Date().toISOString(),
          message,
          ...extra,
        })
      );
    },
    error(message, extra = {}) {
      console.error(
        JSON.stringify({
          level: "error",
          timestamp: new Date().toISOString(),
          message,
          ...extra,
        })
      );
    },
    config,
  };
}
