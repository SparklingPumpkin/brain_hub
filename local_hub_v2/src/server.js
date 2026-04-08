import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { routeRequest } from "./routes/router.js";
import { createFsStore } from "./store/fs-store.js";
import { HttpError } from "./utils/errors.js";
import { readJsonBody, sendResponse } from "./utils/http.js";
import { createLogger } from "./utils/logger.js";

export async function createHubServer(overrides = {}) {
  const config = await loadConfig({
    configPath:
      overrides.configPath ?? path.resolve(process.cwd(), "hub.config.json"),
    overrides,
  });
  const store = createFsStore(config.rootDir);
  const logger = createLogger(config);
  await store.init();

  const context = {
    config,
    store,
    logger,
    runtimePort: config.port,
  };

  const server = http.createServer(async (request, response) => {
    try {
      const body =
        request.method === "POST" || request.method === "PUT"
          ? await readJsonBody(request)
          : {};
      const result = await routeRequest(context, {
        method: request.method ?? "GET",
        url: request.url ?? "/",
        body,
        headers: request.headers,
        baseUrl: context.config.hubUrl,
      });
      sendResponse(response, result);
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : error.statusCode ?? 500;
      const details = error instanceof HttpError ? error.details : undefined;
      logger.error("Request failed", {
        error: error.message,
        stack: error.stack,
      });
      sendResponse(response, {
        statusCode,
        body: {
          ok: false,
          error: {
            message: error.message,
            details,
          },
        },
      });
    }
  });

  return {
    config,
    store,
    logger,
    server,
    async start() {
      await new Promise((resolve) => {
        server.listen(config.port, config.host, resolve);
      });
      const address = server.address();
      if (address && typeof address === "object") {
        context.runtimePort = address.port;
        context.config.hubUrl = `http://${config.host}:${address.port}`;
      }
      logger.info("Hub started", {
        host: config.host,
        port: context.runtimePort,
        root_dir: config.rootDir,
      });
      return server;
    },
    async stop() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
    address() {
      return server.address();
    },
  };
}

const isEntrypoint =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isEntrypoint) {
  const hub = await createHubServer();
  await hub.start();
}
