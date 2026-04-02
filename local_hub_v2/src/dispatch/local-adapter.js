import { spawn } from "node:child_process";

function splitCommand(commandLine) {
  const matches =
    commandLine.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((token) =>
      token.replace(/^"(.*)"$/, "$1")
    ) ?? [];
  if (matches.length === 0) {
    throw new Error("codexAdapterCommand is empty");
  }
  return matches;
}

export async function runLocalAdapter({
  config,
  inputPath,
  projectId,
  cycleId,
}) {
  const [command, ...baseArgs] = splitCommand(config.codexAdapterCommand);
  const resolvedCommand = command === "node" ? process.execPath : command;
  const args = [
    ...baseArgs,
    "--input",
    inputPath,
    "--hub",
    config.hubUrl,
    "--project",
    projectId,
    "--cycle",
    cycleId,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(resolvedCommand, args, {
      cwd: config.projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        const error = new Error(
          `Local adapter exited with code ${code}: ${stderr || stdout}`.trim()
        );
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}
