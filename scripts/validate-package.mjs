import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "AGENTS.md",
  "README.md",
  "LICENSE",
  "package.json",
  ".codex-plugin/plugin.json",
  ".claude-plugin/plugin.json",
  ".agents/plugins/marketplace.json",
  ".claude-plugin/marketplace.json",
  "hooks/hooks.json",
  "hooks/inject-roadmap.mjs",
  "hooks/land-roadmap.mjs",
  "skills/idiots-roadmap/SKILL.md",
  "skills/idiots-roadmap/agents/openai.yaml",
  "skills/idiots-roadmap/references/roadmap-protocol.md",
];

for (const relative of required) {
  assert.ok(fs.existsSync(path.join(root, relative)), `Missing required file: ${relative}`);
}

const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const packageJson = readJson("package.json");
const codex = readJson(".codex-plugin/plugin.json");
const claude = readJson(".claude-plugin/plugin.json");
const codexMarketplace = readJson(".agents/plugins/marketplace.json");
const claudeMarketplace = readJson(".claude-plugin/marketplace.json");
const hooks = readJson("hooks/hooks.json");

assert.match(codex.version, /^\d+\.\d+\.\d+$/);
assert.equal(packageJson.version, codex.version);
assert.equal(claude.version, codex.version);
assert.equal(codex.name, "idiots-roadmap");
assert.equal(claude.name, codex.name);
assert.equal(Object.hasOwn(codex, "hooks"), false, "Codex discovers hooks/hooks.json; manifest must omit rejected hooks field.");
assert.equal(codex.skills, "./skills/");
assert.equal(codexMarketplace.plugins[0].name, codex.name);
assert.equal(codexMarketplace.plugins[0].policy.installation, "AVAILABLE");
assert.equal(codexMarketplace.plugins[0].policy.authentication, "ON_INSTALL");
assert.equal(claudeMarketplace.plugins[0].source, "./");
assert.deepEqual(Object.keys(hooks.hooks).sort(), ["PreToolUse", "Stop", "UserPromptSubmit"]);

for (const relative of required) {
  const content = fs.readFileSync(path.join(root, relative), "utf8");
  assert.equal(content.includes("[TODO:"), false, `Placeholder found in ${relative}`);
}

console.log("Package structure and manifests are valid.");
