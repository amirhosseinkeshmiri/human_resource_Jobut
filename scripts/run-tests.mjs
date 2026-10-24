import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const roots = {
  unit: "src",
  integration: "test/integration",
};

const suite = process.argv[2];
const root = roots[suite];
if (!root) {
  console.error("Usage: node scripts/run-tests.mjs <unit|integration>");
  process.exit(2);
}

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findTests(entryPath);
      return entry.isFile() && entry.name.endsWith(".test.ts") ? [entryPath] : [];
    });
}

const tests = findTests(root).sort();
if (tests.length === 0) {
  console.error(`No ${suite} tests found under ${root}`);
  process.exit(1);
}

const batches = suite === "integration" ? tests.map((test) => [test]) : [tests];
for (const batch of batches) {
  const result = spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", "--test", "--test-isolation=none", ...batch],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
