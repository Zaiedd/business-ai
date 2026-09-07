import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const REGISTRY = (name) => `https://ui.bklit.com/r/${name}.json`;
const COMPONENTS_ROOT = join(process.cwd(), "src", "components");

const roots = ["area-chart", "bar-chart", "ring-chart", "gauge-chart", "radar-chart"];

const queue = [...roots];
const seen = new Set();
const files = new Map();
const npmDeps = new Set();

while (queue.length > 0) {
  const name = queue.shift();
  if (seen.has(name)) continue;
  seen.add(name);
  const url = REGISTRY(name);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed ${url}: ${res.status}`);
  const item = await res.json();
  if (!Array.isArray(item.files)) continue;
  for (const file of item.files) {
    const rel = file.target || file.path.replace(/^src\//, "components/");
    files.set(rel.replace(/^components\//, ""), file.content);
  }
  for (const dep of item.dependencies || []) {
    const bare = dep.split("@")[0] === "" ? `@${dep.split("@")[1]}` : dep.split("@")[0];
    npmDeps.add(bare);
  }
  for (const dep of item.registryDependencies || []) {
    if (dep.startsWith("@bklit/")) {
      queue.push(dep.slice("@bklit/".length));
    }
  }
}

for (const [rel, content] of files) {
  const abs = join(COMPONENTS_ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, { encoding: "utf8" });
}

const depList = [...npmDeps].sort();
writeFileSync(
  join(process.cwd(), "bklit-deps.json"),
  JSON.stringify({ charts: [...seen].sort(), files: files.size, deps: depList }, null, 2),
  { encoding: "utf8" }
);
console.log(`charts: ${[...seen].sort().join(", ")}`);
console.log(`files: ${files.size}`);
console.log(`deps: ${depList.join(", ")}`);