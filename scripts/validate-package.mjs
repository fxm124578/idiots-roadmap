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
  "hooks/lib/project-analysis.mjs",
  "hooks/lib/project-state.mjs",
  "scripts/roadmap-state.mjs",
  "skills/idiots-roadmap/scripts/project-state.mjs",
  "skills/idiots-roadmap/scripts/roadmap-state.mjs",
  "skills/idiots-roadmap/SKILL.md",
  "skills/idiots-roadmap/agents/openai.yaml",
  "skills/idiots-roadmap/references/roadmap-protocol.md",
  "skills/idiots-roadmap-start/SKILL.md",
  "skills/idiots-roadmap-start/agents/openai.yaml",
  "skills/idiots-roadmap-finish/SKILL.md",
  "skills/idiots-roadmap-finish/agents/openai.yaml",
  "skills/idiots-roadmap-align/SKILL.md",
  "skills/idiots-roadmap-align/agents/openai.yaml",
  "skills/spec-ops/SKILL.md",
  "skills/spec-ops/agents/openai.yaml",
  "skills/spec-ops/scripts/spec-ops.mjs",
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
const skillNames = ["idiots-roadmap", "idiots-roadmap-start", "idiots-roadmap-finish", "idiots-roadmap-align", "spec-ops"];
const skill = fs.readFileSync(path.join(root, "skills/idiots-roadmap/SKILL.md"), "utf8");

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

for (const name of skillNames) {
  const content = fs.readFileSync(path.join(root, "skills", name, "SKILL.md"), "utf8");
  const ui = fs.readFileSync(path.join(root, "skills", name, "agents/openai.yaml"), "utf8");
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/u)?.[1];
  assert.ok(frontmatter, `${name}/SKILL.md must have YAML frontmatter.`);
  const frontmatterKeys = [...frontmatter.matchAll(/^([a-z_]+):/gmu)].map((match) => match[1]);
  assert.deepEqual(frontmatterKeys.sort(), ["description", "name"]);
  assert.match(frontmatter, new RegExp(`^name:\\s*${name}\\s*$`, "mu"));
  assert.ok(content.split(/\r?\n/u).length <= 500, `${name}/SKILL.md must stay under 500 lines.`);
  assert.match(ui, new RegExp(`default_prompt:\\s*"[^"]*\\$${name}[^"]*"`, "u"));
}
assert.match(skill, /project\.origin: existing/u);
assert.match(skill, /只提出当前批次/u);
assert.match(skill, /current\.approval/u);
assert.match(skill, /IDIOTS_ROADMAP_LANDING_MODE: hook/u);
assert.match(skill, /deferred-direct/u);
assert.match(skill, /Proma Pi/u);

const canonicalEngine = fs.readFileSync(path.join(root, "hooks/lib/project-state.mjs"), "utf8");
const portableEngine = fs.readFileSync(path.join(root, "skills/idiots-roadmap/scripts/project-state.mjs"), "utf8");
const canonicalRunner = fs.readFileSync(path.join(root, "scripts/roadmap-state.mjs"), "utf8").replace(
  'from "../hooks/lib/project-state.mjs";',
  'from "./project-state.mjs";',
);
const portableRunner = fs.readFileSync(path.join(root, "skills/idiots-roadmap/scripts/roadmap-state.mjs"), "utf8");
assert.equal(portableEngine, canonicalEngine, "Portable project-state runtime is stale; run npm run sync:portable.");
assert.equal(portableRunner, canonicalRunner, "Portable roadmap-state runtime is stale; run npm run sync:portable.");
assert.deepEqual(packageJson.files, [
  ".agents/plugins/marketplace.json",
  ".claude-plugin/",
  ".codex-plugin/",
  "hooks/",
  "skills/",
  "scripts/roadmap-state.mjs",
  "README.md",
  "LICENSE",
]);

for (const relative of required) {
  const content = fs.readFileSync(path.join(root, relative), "utf8");
  assert.equal(content.includes("[TODO:"), false, `Placeholder found in ${relative}`);
}

console.log("Package structure and manifests are valid.");
