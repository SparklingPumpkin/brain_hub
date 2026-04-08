function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildRemotePanelHtml(title) {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    :root {
      --bg: #f3efe7;
      --surface: rgba(255,255,255,0.92);
      --surface-strong: #fffdfa;
      --line: rgba(65, 50, 40, 0.12);
      --ink: #241d18;
      --muted: #6a5d52;
      --accent: #0f766e;
      --accent-strong: #115e59;
      --warn: #92400e;
      --radius: 18px;
      --shadow: 0 20px 40px rgba(40, 30, 20, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top right, rgba(15,118,110,0.12), transparent 24%),
        linear-gradient(180deg, #f8f5ef 0%, var(--bg) 100%);
    }
    .shell {
      width: min(980px, calc(100% - 1rem));
      margin: 0 auto;
      padding: 1rem 0 2rem;
      display: grid;
      gap: 1rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 1rem;
    }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: clamp(1.9rem, 5vw, 3rem); margin-bottom: 0.4rem; }
    h2 { font-size: 1.1rem; margin-bottom: 0.75rem; }
    .hero p, .muted { color: var(--muted); }
    .grid { display: grid; gap: 1rem; }
    .toolbar, .split { display: grid; gap: 0.8rem; }
    .toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .split { grid-template-columns: 1.1fr 0.9fr; }
    label { display: grid; gap: 0.35rem; font-size: 0.95rem; }
    input, textarea, select, button {
      font: inherit;
      border-radius: 12px;
      border: 1px solid var(--line);
    }
    input, textarea, select {
      width: 100%;
      padding: 0.8rem 0.9rem;
      background: var(--surface-strong);
    }
    textarea { min-height: 7rem; resize: vertical; }
    button {
      padding: 0.85rem 1rem;
      background: var(--accent);
      color: white;
      border: 0;
      font-weight: 600;
    }
    button.secondary { background: #e7f6f4; color: var(--accent-strong); border: 1px solid rgba(15,118,110,0.15); }
    button.warn { background: #fff4e8; color: var(--warn); border: 1px solid rgba(146,64,14,0.14); }
    .project-list { display: grid; gap: 0.7rem; }
    .project-item {
      padding: 0.9rem;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--surface-strong);
      display: grid;
      gap: 0.35rem;
    }
    .project-meta, .status-bar { display: flex; gap: 0.6rem; flex-wrap: wrap; color: var(--muted); font-size: 0.9rem; }
    .pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.2rem 0.6rem;
      font-size: 0.8rem;
      background: #ecfdf5;
      color: #166534;
    }
    pre {
      margin: 0;
      padding: 0.9rem;
      overflow: auto;
      border-radius: 14px;
      background: #1c1917;
      color: #f5f5f4;
      font-size: 0.85rem;
      line-height: 1.55;
    }
    .hidden { display: none; }
    @media (max-width: 760px) {
      .toolbar, .split { grid-template-columns: 1fr; }
      .shell { width: min(100% - 0.75rem, 980px); }
      button { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="card hero">
      <h1>${safeTitle}</h1>
      <p>Mobile-friendly task view for Tailscale access. Enter the shared token once, then we can watch runs, dispatch work, and submit new tasks from Android.</p>
    </section>

    <section class="card">
      <div class="toolbar">
        <label>
          Remote Token
          <input id="token" type="password" placeholder="Bearer token">
        </label>
        <div class="grid">
          <button id="connect">Connect</button>
          <button id="refresh" class="secondary">Refresh</button>
        </div>
      </div>
      <div id="status" class="status-bar" style="margin-top:0.85rem;"></div>
    </section>

    <section class="split">
      <section class="card">
        <h2>Projects</h2>
        <div id="projects" class="project-list"></div>
      </section>

      <section class="card">
        <h2>New Task</h2>
        <div class="grid">
          <label>Project ID<input id="projectId" placeholder="demo_project"></label>
          <label>Cycle ID<input id="cycleId" placeholder="001"></label>
          <label>Session Mode
            <select id="sessionMode">
              <option value="new">new</option>
              <option value="project">project</option>
              <option value="resume">resume</option>
              <option value="last">last</option>
            </select>
          </label>
          <label>Session ID<input id="sessionId" placeholder="optional for resume/project"></label>
          <label>Goal<textarea id="goal" placeholder="Describe the next task."></textarea></label>
          <label>Constraints<textarea id="constraints" placeholder="One per line"></textarea></label>
          <label><input id="autoDispatch" type="checkbox" checked> Dispatch immediately</label>
          <button id="submitTask">Submit Task</button>
        </div>
      </section>
    </section>

    <section class="card">
      <h2>Selected Project</h2>
      <div id="selectedSummary" class="muted">No project selected yet.</div>
      <div class="grid" style="margin-top:1rem;">
        <button id="dispatchSelected" class="secondary">Dispatch Selected Run</button>
        <pre id="projectDetail">{}</pre>
      </div>
    </section>
  </div>

  <script>
    const tokenInput = document.getElementById("token");
    const statusEl = document.getElementById("status");
    const projectsEl = document.getElementById("projects");
    const detailEl = document.getElementById("projectDetail");
    const selectedSummaryEl = document.getElementById("selectedSummary");
    const selected = { projectId: null, cycleId: null };

    tokenInput.value = localStorage.getItem("localHubRemoteToken") || "";

    function setStatus(message, tone = "muted") {
      statusEl.innerHTML = "<span class=\\"pill\\">" + tone + "</span><span>" + message + "</span>";
    }

    function authHeaders() {
      const token = tokenInput.value.trim();
      if (!token) {
        throw new Error("Remote token is required");
      }
      localStorage.setItem("localHubRemoteToken", token);
      return { Authorization: "Bearer " + token };
    }

    async function api(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
          ...authHeaders(),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message || "Request failed");
      }
      return data;
    }

    function renderProjects(projects) {
      projectsEl.innerHTML = "";
      if (!projects.length) {
        projectsEl.innerHTML = "<div class=\\"muted\\">No projects yet.</div>";
        return;
      }
      for (const project of projects) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "project-item";
        button.innerHTML = [
          "<strong>" + project.project_id + "</strong>",
          "<div class=\\"project-meta\\">",
          "<span>Status: " + (project.current_status || "unknown") + "</span>",
          "<span>Cycle: " + (project.active_cycle_id || "-") + "</span>",
          "<span>Session: " + (project.latest_codex_session_id || "none") + "</span>",
          "</div>",
        ].join("");
        button.addEventListener("click", () => loadProject(project.project_id));
        projectsEl.appendChild(button);
      }
    }

    async function loadOverview() {
      setStatus("Loading overview...");
      const data = await api("/remote-api/overview");
      renderProjects(data.projects || []);
      setStatus("Connected. Overview refreshed.", "ready");
    }

    async function loadProject(projectId) {
      setStatus("Loading project " + projectId + "...");
      const data = await api("/remote-api/projects/" + encodeURIComponent(projectId));
      selected.projectId = projectId;
      selected.cycleId = data.state?.active_cycle_id || null;
      selectedSummaryEl.textContent =
        "Project " + projectId + ", cycle " + (selected.cycleId || "-") +
        ", status " + (data.state?.current_status || "unknown");
      detailEl.textContent = JSON.stringify(data, null, 2);
      setStatus("Project loaded.", "ready");
    }

    async function submitTask() {
      const constraints = document.getElementById("constraints").value
        .split(/\\r?\\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const payload = {
        project_id: document.getElementById("projectId").value.trim(),
        cycle_id: document.getElementById("cycleId").value.trim(),
        goal: document.getElementById("goal").value.trim(),
        constraints,
        session_mode: document.getElementById("sessionMode").value,
        session_id: document.getElementById("sessionId").value.trim() || null,
        auto_dispatch: document.getElementById("autoDispatch").checked,
      };
      setStatus("Submitting task...");
      const data = await api("/remote-api/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setStatus("Task submitted.", "ready");
      await loadOverview();
      await loadProject(data.project_id);
    }

    async function dispatchSelected() {
      if (!selected.projectId || !selected.cycleId) {
        throw new Error("Select a project first");
      }
      setStatus("Dispatching " + selected.projectId + "/" + selected.cycleId + "...");
      await api(
        "/remote-api/runs/" + encodeURIComponent(selected.projectId) + "/" + encodeURIComponent(selected.cycleId) + "/dispatch",
        { method: "POST" }
      );
      await loadProject(selected.projectId);
      await loadOverview();
      setStatus("Dispatch complete.", "ready");
    }

    document.getElementById("connect").addEventListener("click", () => loadOverview().catch((error) => setStatus(error.message, "error")));
    document.getElementById("refresh").addEventListener("click", () => loadOverview().catch((error) => setStatus(error.message, "error")));
    document.getElementById("submitTask").addEventListener("click", () => submitTask().catch((error) => setStatus(error.message, "error")));
    document.getElementById("dispatchSelected").addEventListener("click", () => dispatchSelected().catch((error) => setStatus(error.message, "error")));

    if (tokenInput.value) {
      loadOverview().catch((error) => setStatus(error.message, "error"));
    } else {
      setStatus("Enter the remote token to connect.");
    }
  </script>
</body>
</html>`;
}
