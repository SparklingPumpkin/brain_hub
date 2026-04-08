import { handleCodexPacket, handleWebPacket } from "./packets.js";
import {
  handleLatestContextPack,
  handleLatestExecution,
  handleProjectState,
} from "./projects.js";
import {
  handleRemoteDispatch,
  handleRemoteOverview,
  handleRemotePanel,
  handleRemoteProject,
  handleRemoteTask,
} from "./remote.js";
import { handleRunDispatch } from "./runs.js";

export async function routeRequest(context, request) {
  const url = new URL(request.url, context.config.hubUrl);
  const { pathname } = url;

  if (request.method === "GET" && pathname === "/health") {
    return {
      statusCode: 200,
      body: {
        ok: true,
        service: "local-hub",
        port: context.runtimePort ?? context.config.port,
        version: context.config.version,
      },
    };
  }

  if (request.method === "POST" && pathname === "/packets/web") {
    return {
      statusCode: 200,
      body: await handleWebPacket(context, request.body),
    };
  }

  if (request.method === "POST" && pathname === "/packets/codex") {
    return {
      statusCode: 200,
      body: await handleCodexPacket(context, request.body),
    };
  }

  if (request.method === "GET" && pathname === "/remote") {
    return handleRemotePanel(context, request);
  }

  if (request.method === "GET" && pathname === "/remote-api/overview") {
    return {
      statusCode: 200,
      body: await handleRemoteOverview(context, request),
    };
  }

  if (request.method === "POST" && pathname === "/remote-api/tasks") {
    return {
      statusCode: 200,
      body: await handleRemoteTask(context, request),
    };
  }

  let match = pathname.match(/^\/projects\/([^/]+)\/state$/);
  if (request.method === "GET" && match) {
    return {
      statusCode: 200,
      body: await handleProjectState(context, decodeURIComponent(match[1])),
    };
  }

  match = pathname.match(/^\/projects\/([^/]+)\/latest-execution$/);
  if (request.method === "GET" && match) {
    return {
      statusCode: 200,
      body: await handleLatestExecution(context, decodeURIComponent(match[1])),
    };
  }

  match = pathname.match(/^\/projects\/([^/]+)\/latest-context-pack$/);
  if (request.method === "GET" && match) {
    return {
      statusCode: 200,
      body: await handleLatestContextPack(context, decodeURIComponent(match[1])),
    };
  }

  match = pathname.match(/^\/runs\/([^/]+)\/([^/]+)\/dispatch$/);
  if (request.method === "POST" && match) {
    return {
      statusCode: 200,
      body: await handleRunDispatch(
        context,
        decodeURIComponent(match[1]),
        decodeURIComponent(match[2])
      ),
    };
  }

  match = pathname.match(/^\/remote-api\/projects\/([^/]+)$/);
  if (request.method === "GET" && match) {
    return {
      statusCode: 200,
      body: await handleRemoteProject(
        context,
        request,
        decodeURIComponent(match[1])
      ),
    };
  }

  match = pathname.match(/^\/remote-api\/runs\/([^/]+)\/([^/]+)\/dispatch$/);
  if (request.method === "POST" && match) {
    return {
      statusCode: 200,
      body: await handleRemoteDispatch(
        context,
        request,
        decodeURIComponent(match[1]),
        decodeURIComponent(match[2])
      ),
    };
  }

  return {
    statusCode: 404,
    body: {
      ok: false,
      error: {
        message: `Route not found: ${request.method} ${pathname}`,
      },
    },
  };
}
