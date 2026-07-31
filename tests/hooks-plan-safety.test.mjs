import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { clearFailures, readFailures, recordFailure } from "../hooks/lib/state.mjs";
import { makeEnvelope } from "./helpers/roadmap-fixture.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runHook(input, { event = "Stop", state, env = {} } = {}) {
  return spawnSync(process.execPath, [
    path.join(repoRoot, "hooks", "land-roadmap.mjs"),
    `--event=${event}`,
  ], {
    cwd: input.cwd || repoRoot,
    env: {
      ...process.env,
      ...env,
      IDIOTS_ROADMAP_STATE_DIR: state,
      PLUGIN_DATA: path.join(input.cwd || repoRoot, "plugin-data"),
    },
    input: JSON.stringify(input),
    encoding: "utf8",
    timeout: 5000,
  });
}

function invalidEnvelope() {
  const envelope = makeEnvelope();
  envelope.text = envelope.text.replace(
    "- 打开结果并确认核心内容正确。",
    "- 第一项\n- 第二项\n- 第三项",
  );
  return envelope.text;
}

function temporaryRoots(t, prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-root-`));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-state-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(state, { recursive: true, force: true }));
  return { root, state };
}

test("ExitPlanMode rejects the first and every later invalid Roadmap", (t) => {
  const { root, state } = temporaryRoots(t, "idiots-exit-fail");
  const input = {
    permission_mode: "plan",
    cwd: root,
    session_id: "same-session",
    tool_name: "ExitPlanMode",
    tool_input: { plan: invalidEnvelope() },
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = runHook(input, { event: "PreToolUse", state });
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
    assert.match(output.hookSpecificOutput.permissionDecisionReason, /不能退出 Plan/);
  }
});

test("Stop corrects once, then stops correcting while Plan and old file remain", (t) => {
  const { root, state } = temporaryRoots(t, "idiots-stop-fail");
  const oldRoadmap = "这是用户已经保存好的旧 Roadmap。\n";
  fs.writeFileSync(path.join(root, "IDIOTS_ROADMAP.md"), oldRoadmap, "utf8");
  const input = {
    permission_mode: "plan",
    cwd: root,
    session_id: "same-session",
    last_assistant_message: invalidEnvelope(),
  };

  const first = JSON.parse(runHook(input, { state }).stdout);
  assert.equal(first.decision, "block");
  assert.match(first.reason, /请只修正/);

  const second = JSON.parse(runHook(input, { state }).stdout);
  assert.equal(Object.hasOwn(second, "decision"), false);
  assert.match(second.systemMessage, /已停止自动纠错/);
  assert.match(second.systemMessage, /第二次校验仍失败/);
  assert.match(second.systemMessage, /仍停留在 Plan/);

  const third = JSON.parse(runHook(input, { state }).stdout);
  assert.equal(Object.hasOwn(third, "decision"), false);
  assert.match(third.systemMessage, /仍停留在 Plan/);
  assert.equal(fs.readFileSync(path.join(root, "IDIOTS_ROADMAP.md"), "utf8"), oldRoadmap);
});

test("missing Plan mode, unknown event, or missing session is safely silent", (t) => {
  const { root, state } = temporaryRoots(t, "idiots-unknown");
  const common = {
    cwd: root,
    session_id: "known-session",
    last_assistant_message: invalidEnvelope(),
  };
  const cases = [
    [{ ...common }, "Stop"],
    [{ ...common, permission_mode: "plan" }, "UnknownEvent"],
    [{ ...common, permission_mode: "plan", session_id: "" }, "Stop"],
    [{ ...common, permission_mode: "plan", tool_name: "OtherTool" }, "PreToolUse"],
  ];

  for (const [input, event] of cases) {
    const result = runHook(input, { event, state });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  }
});

test("ExitPlanMode with no Roadmap is denied instead of silently escaping", (t) => {
  const { root, state } = temporaryRoots(t, "idiots-missing-roadmap");
  const result = runHook({
    permission_mode: "plan",
    cwd: root,
    session_id: "known-session",
    tool_name: "ExitPlanMode",
    tool_input: { plan: "普通计划，但没有 Roadmap 标记。" },
  }, { event: "PreToolUse", state });

  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /没有找到可保存/);
});

test("failure counters are isolated by goal, event, revision, and expire", (t) => {
  const { root } = temporaryRoots(t, "idiots-state");
  const base = {
    sessionId: "session-1",
    goal: "目标 A",
    event: "Stop",
    revision: "4",
  };

  assert.equal(recordFailure(root, base, { now: 1_000, ttlMs: 100 }), 1);
  assert.equal(recordFailure(root, base, { now: 1_010, ttlMs: 100 }), 2);
  assert.equal(readFailures(root, { ...base, goal: "目标 B" }, { now: 1_020 }), 0);
  assert.equal(readFailures(root, { ...base, event: "PreToolUse" }, { now: 1_020 }), 0);
  assert.equal(readFailures(root, { ...base, revision: "5" }, { now: 1_020 }), 0);
  assert.equal(readFailures(root, base, { now: 1_111 }), 0);
  assert.equal(recordFailure(root, base, { now: 1_112, ttlMs: 100 }), 1);
  clearFailures(root, base);
  assert.equal(readFailures(root, base, { now: 1_113 }), 0);
});
