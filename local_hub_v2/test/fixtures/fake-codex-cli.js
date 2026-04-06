import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const parsed = {
    mode: "success",
  };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function findArgValue(argv, key) {
  const index = argv.indexOf(key);
  if (index === -1 || index + 1 >= argv.length) {
    return null;
  }
  return argv[index + 1];
}

async function ensureGitRepo(workspace) {
  const gitDir = path.join(workspace, ".git");
  try {
    await fs.access(gitDir);
  } catch {
    throw new Error("Workspace must be a git repository in fake-codex-cli");
  }
}

async function main() {
  const options = parseArgs(process.argv);
  const outputFile = findArgValue(process.argv, "-o");
  const workspace = findArgValue(process.argv, "-C");

  if (!outputFile || !workspace) {
    throw new Error("Missing -o or -C argument");
  }

  await ensureGitRepo(workspace);

  if (options.mode === "fail") {
    throw new Error("Intentional fake codex failure");
  }

  const targetFile = path.join(workspace, "src", "sum.js");
  const current = await fs.readFile(targetFile, "utf8");
  if (!current.includes("multiply")) {
    await fs.writeFile(
      targetFile,
      `${current}\nexport function multiply(a, b) {\n  return a * b;\n}\n`,
      "utf8"
    );
  }

  const payload = {
    execution_report: {
      changed_files: [],
      summary: ["Implemented multiply helper in src/sum.js."],
      verification: ["node --test"],
      open_issues: [],
      risks: [],
      next_step: "ready_for_review",
    },
    context_pack: {
      current_goal: "Complete arithmetic helper update",
      completed: ["Added multiply implementation."],
      key_files: ["src/sum.js"],
      latest_verification: ["node --test"],
      open_questions: [],
      risks: [],
      suggested_next_step: "Review and merge.",
      web_recovery_prompt: "Continue with review for arithmetic helper update."
    },
    status: "completed",
  };

  await fs.writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(2);
});
