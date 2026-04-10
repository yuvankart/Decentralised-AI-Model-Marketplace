const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const backendCwd = path.join(root, "backend");

function resolveBackendCommand() {
  const candidates = [
    {
      command: path.join(backendCwd, "venv", "bin", "uvicorn"),
      args: ["main:app", "--host", "127.0.0.1", "--port", "8000"],
    },
    {
      command: path.join(backendCwd, "venv", "Scripts", "uvicorn.exe"),
      args: ["main:app", "--host", "127.0.0.1", "--port", "8000"],
    },
    {
      command: path.join(backendCwd, "venv", "Scripts", "python.exe"),
      args: ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
    },
    {
      command: "python3",
      args: ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
    },
    {
      command: "python",
      args: ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
    },
  ];

  for (const candidate of candidates) {
    if (candidate.command.includes(path.sep)) {
      if (fs.existsSync(candidate.command)) {
        return candidate;
      }
      continue;
    }

    return candidate;
  }

  return candidates[candidates.length - 1];
}

const backendService = resolveBackendCommand();

console.log(
  `Starting backend with: ${backendService.command} ${backendService.args.join(" ")}`
);

const child = spawn(backendService.command, backendService.args, {
  cwd: backendCwd,
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Failed to start backend: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
