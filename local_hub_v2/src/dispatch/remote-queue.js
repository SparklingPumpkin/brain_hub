export async function enqueueRemoteDispatch(store, runRecord) {
  await store.enqueuePendingRun(runRecord);
  return {
    mode: "remote_worker",
    queued: true,
  };
}
