import { dispatchToCodex } from "../dispatch/dispatcher.js";
import { HttpError } from "../utils/errors.js";

export async function handleRunDispatch(context, projectId, cycleId) {
  const existingRun = await context.store.getRunRecord(projectId, cycleId);
  if (!existingRun) {
    throw new HttpError(404, "Run not found");
  }

  const updatedRun = await dispatchToCodex(context, { projectId, cycleId });
  return {
    ok: true,
    run_id: updatedRun.run_id,
    status: updatedRun.status,
    attempt_count: updatedRun.attempt_count,
  };
}
