const hubPill = document.getElementById('hub-pill');
const hubSummary = document.getElementById('hub-summary');
const packetPill = document.getElementById('packet-pill');
const packetProject = document.getElementById('packet-project');
const packetCycle = document.getElementById('packet-cycle');
const packetStage = document.getElementById('packet-stage');
const packetGoal = document.getElementById('packet-goal');
const runPill = document.getElementById('run-pill');
const runStatus = document.getElementById('run-status');
const runCycle = document.getElementById('run-cycle');
const runUpdated = document.getElementById('run-updated');
const executionSummary = document.getElementById('execution-summary');
const contextNext = document.getElementById('context-next');
const autoDispatchToggle = document.getElementById('auto-dispatch-toggle');
const autoDispatchLabel = document.getElementById('auto-dispatch-label');
const loopbackStatus = document.getElementById('loopback-status');
const statusLine = document.getElementById('status-line');
const refreshButton = document.getElementById('refresh-button');
const dispatchButton = document.getElementById('dispatch-button');

let autoRefreshTimer = null;

function setPill(element, label, tone) {
  element.textContent = label;
  element.className = `pill ${tone}`;
}

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function renderList(element, items, fallback) {
  element.textContent = '';

  if (!Array.isArray(items) || items.length === 0) {
    const li = document.createElement('li');
    li.textContent = fallback;
    element.appendChild(li);
    return;
  }

  items.slice(0, 5).forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    element.appendChild(li);
  });
}

function renderState(state) {
  const hub = state?.hub || {};
  const packet = state?.lastPacket || {};
  const snapshot = state?.projectSnapshot || {};
  const projectState = snapshot?.state || null;
  const execution = snapshot?.latestExecution?.parsed || null;
  const contextPack = snapshot?.latestContextPack?.parsed || null;

  if (hub.ok) {
    setPill(hubPill, 'Online', 'pill-good');
    hubSummary.textContent = `${hub.baseUrl || 'http://127.0.0.1:8765'} - ${hub.version || 'unknown version'} - checked ${formatTime(hub.checkedAt)}`;
  } else {
    setPill(hubPill, 'Offline', 'pill-bad');
    hubSummary.textContent = hub.error || 'Hub not reachable.';
  }

  if (packet.projectId) {
    setPill(packetPill, 'Captured', 'pill-good');
  } else {
    setPill(packetPill, 'Idle', 'pill-neutral');
  }

  packetProject.textContent = packet.projectId || '-';
  packetCycle.textContent = packet.cycleId || '-';
  packetStage.textContent = packet.stage || '-';
  packetGoal.textContent = packet.goal || 'No packet captured yet.';

  const runTone = !projectState
    ? 'pill-neutral'
    : projectState.current_status === 'completed'
      ? 'pill-good'
      : (projectState.current_status === 'needs_review' || projectState.current_status === 'pending')
        ? 'pill-warn'
        : projectState.current_status === 'blocked'
          ? 'pill-bad'
          : 'pill-neutral';
  setPill(runPill, projectState?.current_status || 'Unknown', runTone);
  runStatus.textContent = projectState?.current_status || '-';
  runCycle.textContent = projectState?.active_cycle_id || packet.cycleId || '-';
  runUpdated.textContent = formatTime(projectState?.last_updated_at);

  renderList(
    executionSummary,
    execution?.summary,
    'No execution report yet.'
  );

  contextNext.textContent =
    contextPack?.suggested_next_step ||
    'No context pack yet.';

  const autoDispatch = Boolean(state?.settings?.autoDispatch);
  autoDispatchToggle.checked = autoDispatch;
  autoDispatchLabel.textContent = autoDispatch ? 'Auto Dispatch On' : 'Auto Dispatch Off';

  const loopback = state?.loopback || {};
  if (loopback.status === 'delivered') {
    loopbackStatus.textContent = `Latest result returned to ChatGPT at ${formatTime(loopback.deliveredAt)}.`;
  } else if (loopback.status === 'failed') {
    loopbackStatus.textContent = `ChatGPT loopback failed: ${loopback.error || 'unknown error'}`;
  } else {
    loopbackStatus.textContent = 'ChatGPT loopback idle.';
  }

  dispatchButton.disabled = !packet.projectId || !packet.cycleId || !hub.ok;

  if (projectState && (projectState.current_status === 'pending' || projectState.current_status === 'running' || projectState.current_status === 'dispatched')) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

function startAutoRefresh() {
  if (autoRefreshTimer) return;
  autoRefreshTimer = setInterval(() => {
    refreshState(false);
  }, 5000);
}

async function request(message) {
  return chrome.runtime.sendMessage(message);
}

async function refreshState(verbose = true) {
  try {
    if (verbose) {
      statusLine.textContent = 'Refreshing Hub state...';
    }
    const state = await request({ type: 'REFRESH_BRIDGE_STATE' });
    renderState(state);
    statusLine.textContent = `Last refreshed at ${formatTime(new Date().toISOString())}.`;
  } catch (error) {
    statusLine.textContent = `Refresh failed: ${String(error)}`;
  }
}

async function dispatchLatestRun() {
  try {
    dispatchButton.disabled = true;
    statusLine.textContent = 'Dispatching latest run...';
    const response = await request({ type: 'DISPATCH_RUN' });
    if (!response.ok) {
      statusLine.textContent = `Dispatch failed: ${JSON.stringify(response.body || response.error || response)}`;
      await refreshState(false);
      return;
    }

    statusLine.textContent = 'Dispatch sent. Refreshing state...';
    await refreshState(false);
  } catch (error) {
    statusLine.textContent = `Dispatch failed: ${String(error)}`;
  } finally {
    dispatchButton.disabled = false;
  }
}

async function setAutoDispatch(enabled) {
  try {
    statusLine.textContent = enabled
      ? 'Enabling auto dispatch...'
      : 'Disabling auto dispatch...';
    const state = await request({
      type: 'SET_AUTO_DISPATCH',
      enabled
    });
    renderState(state);
    statusLine.textContent = enabled
      ? 'Auto dispatch enabled.'
      : 'Auto dispatch disabled.';
  } catch (error) {
    autoDispatchToggle.checked = !enabled;
    statusLine.textContent = `Failed to update auto dispatch: ${String(error)}`;
  }
}

refreshButton.addEventListener('click', () => {
  refreshState(true);
});

dispatchButton.addEventListener('click', () => {
  dispatchLatestRun();
});

autoDispatchToggle.addEventListener('change', () => {
  setAutoDispatch(autoDispatchToggle.checked);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  }
});

request({ type: 'GET_BRIDGE_STATE' })
  .then((state) => {
    renderState(state);
    statusLine.textContent = 'Popup connected to background state.';
  })
  .catch((error) => {
    statusLine.textContent = `Failed to load initial state: ${String(error)}`;
  });
