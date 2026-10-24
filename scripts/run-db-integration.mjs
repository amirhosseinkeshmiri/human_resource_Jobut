import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
run(process.execPath, ["scripts/verify-integration-database.mjs"]);
run(npm, ["run", "db:check"]);
run(npm, ["run", "db:migrate"]);
run(process.execPath, ["scripts/verify-integration-database.mjs"]);
run(npm, ["run", "test:integration"]);
