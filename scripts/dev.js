const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

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

const services = [
  {
    name: "backend",
    command: backendService.command,
    args: backendService.args,
    cwd: backendCwd,
  },
  {
    name: "server",
    command: "node",
    args: ["index.js"],
    cwd: path.join(root, "server"),
  },
  {
    name: "frontend",
    command: "python3",
    args: ["-m", "http.server", "5173", "--directory", "frontend"],
    cwd: root,
  },
];

const children = [];
let shuttingDown = false;

function prefixOutput(name, stream, data) {
  const lines = data.toString().split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    stream.write(`[${name}] ${line}\n`);
  }
}

function stopAll(signal = "SIGTERM") {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

console.log("Starting local demo services...");
console.log("Frontend: http://127.0.0.1:5173");
console.log("Node API:  http://127.0.0.1:3001");
console.log("FastAPI:   http://127.0.0.1:8000");
console.log(`Backend command: ${backendService.command} ${backendService.args.join(" ")}`);
console.log("Press Ctrl+C to stop all services.\n");

for (const service of services) {
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env: process.env,
  });

  children.push(child);

  child.stdout.on("data", (data) => prefixOutput(service.name, process.stdout, data));
  child.stderr.on("data", (data) => prefixOutput(service.name, process.stderr, data));

  child.on("error", (error) => {
    console.error(`[${service.name}] Failed to start: ${error.message}`);
    stopAll();
  });

  child.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[${service.name}] exited with code ${code ?? "null"} signal ${signal ?? "null"}`);
      stopAll();
    }
  });
}

process.on("SIGINT", () => {
  console.log("\nStopping local demo services...");
  stopAll("SIGINT");
});

process.on("SIGTERM", () => stopAll("SIGTERM"));
