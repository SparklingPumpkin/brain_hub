import { HttpError } from "../utils/errors.js";

export async function handleProjectState(context, projectId) {
  const state = await context.store.getProjectState(projectId);
  if (!state) {
    throw new HttpError(404, "Project state not found");
  }
  return {
    ok: true,
    state,
  };
}

export async function handleLatestExecution(context, projectId) {
  const packet = await context.store.getLatestExecution(projectId);
  if (!packet) {
    throw new HttpError(404, "Latest execution packet not found");
  }
  return {
    ok: true,
    packet,
  };
}

export async function handleLatestContextPack(context, projectId) {
  const packet = await context.store.getLatestContextPack(projectId);
  if (!packet) {
    throw new HttpError(404, "Latest context pack not found");
  }
  return {
    ok: true,
    packet,
  };
}
