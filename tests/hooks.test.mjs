import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { makeEnvelope } from "./helpers/roadmap-fixture.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runHook(script, input, { env = {}, args = [] } = {}) {
  return spawnSync(process.execPath, [path.join(repoRoot, "hooks", script), ...args], {
    cwd: input.cwd || repoRoot,
    env: { ...process.env, ...env },
    input: JSON.stringify(input),
    encoding: "utf8",
    timeout: 5000,
  });
}

test("UserPromptSubmit is completely silent outside Plan mode", () => {
  const result = runHook("inject-roadmap.mjs", { permission_mode: "default", cwd: repoRoot });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("Codex Plan input receives JSON additionalContext and dynamic languages", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-inject-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "app.tsx"), "");
  const result = runHook(
    "inject-roadmap.mjs",
    { permission_mode: "plan", cwd: root },
    { env: { PLUGIN_DATA: path.join(root, "plugin-data") } },
  );
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.match(output.hookSpecificOutput.additionalContext, /完全不看代码/);
  assert.match(output.hookSpecificOutput.additionalContext, /JavaScript\/TypeScript\/CSS/);
  assert.match(output.hookSpecificOutput.additionalContext, /hasFrontend=true/);
  assert.match(output.hookSpecificOutput.additionalContext, /Git 只读检测/);
  assert.match(output.hookSpecificOutput.additionalContext, /"remoteProvider":"none"/);
});

test("Claude Plan input receives plain context", () => {
  const result = runHook("inject-roadmap.mjs", { permission_mode: "plan", cwd: repoRoot }, {
    env: { PLUGIN_DATA: "", CODEX_THREAD_ID: "" },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^IDIOTS ROADMAP PLAN PROTOCOL/);
});

test("opt-out marker never creates a Roadmap", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-optout-"));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-state-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(state, { recursive: true, force: true }));
  const result = runHook(
    "land-roadmap.mjs",
    {
      permission_mode: "plan",
      cwd: root,
      session_id: "skip",
      last_assistant_message: "<!-- IDIOTS_ROADMAP:OPTOUT -->",
    },
    { env: { IDIOTS_ROADMAP_STATE_DIR: state, PLUGIN_DATA: path.join(root, "plugin-data") }, args: ["--event=Stop"] },
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(fs.existsSync(path.join(root, "IDIOTS_ROADMAP.md")), false);
});

test("Stop writes a valid Codex Roadmap", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-stop-"));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-state-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(state, { recursive: true, force: true }));
  const result = runHook(
    "land-roadmap.mjs",
    {
      permission_mode: "plan",
      cwd: root,
      session_id: "valid",
      stop_hook_active: false,
      last_assistant_message: makeEnvelope().text,
    },
    { env: { IDIOTS_ROADMAP_STATE_DIR: state, PLUGIN_DATA: path.join(root, "plugin-data") }, args: ["--event=Stop"] },
  );
  assert.equal(result.status, 0);
  assert.match(JSON.parse(result.stdout).systemMessage, /已写入/);
  assert.equal(fs.existsSync(path.join(root, "IDIOTS_ROADMAP.md")), true);
});

test("ExitPlanMode input is preferred and denied after writing", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-exit-plan-"));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-state-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(state, { recursive: true, force: true }));
  const result = runHook(
    "land-roadmap.mjs",
    {
      permission_mode: "plan",
      cwd: root,
      session_id: "exit",
      tool_name: "ExitPlanMode",
      tool_input: { plan: makeEnvelope().text },
    },
    { env: { IDIOTS_ROADMAP_STATE_DIR: state, PLUGIN_DATA: "" }, args: ["--event=PreToolUse"] },
  );
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
  assert.equal(fs.existsSync(path.join(root, "IDIOTS_ROADMAP.md")), true);
});

test("invalid Roadmap gets one correction attempt, then preserves the old file", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-correction-"));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-state-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(state, { recursive: true, force: true }));
  const valid = makeEnvelope();
  fs.writeFileSync(path.join(root, "IDIOTS_ROADMAP.md"), valid.markdown, "utf8");
  const invalid = makeEnvelope();
  invalid.text = invalid.text.replace("- 打开结果并确认核心内容正确。", "- 一\n- 二\n- 三");
  const input = {
    permission_mode: "plan",
    cwd: root,
    session_id: "retry",
    last_assistant_message: invalid.text,
  };
  const options = {
    env: { IDIOTS_ROADMAP_STATE_DIR: state, PLUGIN_DATA: path.join(root, "plugin-data") },
    args: ["--event=Stop"],
  };
  const first = JSON.parse(runHook("land-roadmap.mjs", input, options).stdout);
  assert.equal(first.decision, "block");
  const before = fs.readFileSync(path.join(root, "IDIOTS_ROADMAP.md"), "utf8");
  const second = JSON.parse(runHook("land-roadmap.mjs", input, options).stdout);
  assert.match(second.systemMessage, /第二次校验仍失败/);
  assert.equal(fs.readFileSync(path.join(root, "IDIOTS_ROADMAP.md"), "utf8"), before);
});
