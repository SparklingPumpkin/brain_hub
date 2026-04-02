import fs from "node:fs/promises";

function parseArgs(argv) {
  const parsed = {};
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key?.startsWith("--")) {
      parsed[key.slice(2)] = value;
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.input || !args.hub || !args.project || !args.cycle) {
    throw new Error("Missing required adapter arguments");
  }

  const packet = JSON.parse(await fs.readFile(args.input, "utf8"));
  const goal = packet?.parsed?.goal ?? "No goal provided";
  const constraints = packet?.parsed?.constraints ?? [];

  const payload = {
    project_id: args.project,
    cycle_id: args.cycle,
    source: "codex-local-adapter",
    execution_report: {
      changed_files: [],
      summary: [
        `Mock adapter received strategy goal: ${goal}`,
        "No repository mutations were performed in mock mode.",
      ],
      verification: ["Mock adapter callback completed"],
      open_issues: [],
      risks: [],
      next_step: "ready_for_review",
    },
    context_pack: {
      current_goal: goal,
      completed: ["Hub dispatch and callback loop completed"],
      key_files: [],
      latest_verification: ["Mock adapter callback completed"],
      open_questions: [],
      risks: [],
      suggested_next_step:
        constraints.length > 0
          ? "Review constraints before switching to a real Codex adapter."
          : "Replace mock adapter with a real Codex adapter.",
      web_recovery_prompt: `Continue project ${args.project} cycle ${args.cycle}. Latest goal: ${goal}`,
    },
    status: "completed",
  };

  const response = await fetch(`${args.hub}/packets/codex`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Hub callback failed with status ${response.status}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
