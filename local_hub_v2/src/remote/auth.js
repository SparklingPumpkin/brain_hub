import crypto from "node:crypto";
import { HttpError } from "../utils/errors.js";

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""));
  const rightBuffer = Buffer.from(String(right ?? ""));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function readBearerToken(request) {
  const authHeader = request.headers?.authorization;
  if (typeof authHeader === "string") {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1].trim();
    }
  }

  const url = new URL(request.url, request.baseUrl);
  const queryToken = url.searchParams.get("token");
  return queryToken ? queryToken.trim() : null;
}

export function assertRemoteAuthorized(context, request) {
  if (!context.config.remoteControlEnabled) {
    throw new HttpError(404, "Remote control is disabled");
  }

  const configuredToken = context.config.remoteControlToken;
  if (typeof configuredToken !== "string" || configuredToken.trim() === "") {
    throw new HttpError(503, "Remote control token is not configured");
  }

  const suppliedToken = readBearerToken(request);
  if (!suppliedToken || !safeEqual(suppliedToken, configuredToken)) {
    throw new HttpError(401, "Remote control token is invalid");
  }
}
