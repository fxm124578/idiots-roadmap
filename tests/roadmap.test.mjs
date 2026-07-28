import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  mergeCompletedSteps,
  parseEnvelope,
  persistRoadmap,
  resolveSafePaths,
  validateRoadmap,
} from "../hooks/lib/roadmap.mjs";
import { makeEnvelope, makeStep } from "./helpers/roadmap-fixture.mjs";

function temporaryProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-roadmap-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("validates a no-code frontend-first roadmap with mock then real integration", () => {
  const envelope = makeEnvelope({
    goal: "查看真实任务",
    hasFrontend: true,
    steps: [
      makeStep({ id: "step-01", kind: "frontend", evidence: "ui", data: "mock" }),
      makeStep({ id: "step-02", kind: "integration", evidence: "ui", data: "real" }),
    ],
  });
  assert.deepEqual(validateRoadmap(envelope).errors, []);
});

test("enforces the user-facing substep and three-action format", () => {
  const envelope = makeEnvelope();
  const step = envelope.markdown.slice(envelope.markdown.indexOf("<!-- IR_STEP"));
  assert.match(step, /^\s*<!-- IR_STEP[^\n]+-->\n\*\*🧩 子步骤 1：/);
  for (const emoji of ["🧩", "📋", "🎯", "⚠️", "🚧", "✅", "☑️", "💬"]) {
    assert.ok(step.includes(emoji), `missing ${emoji}`);
  }
  assert.doesNotMatch(step, /完成后你会看到|IR_FIELD:visible/);
  assert.equal([...step.matchAll(/^```(?:text)?\s*$/gm)].length, 2);
  assert.match(step, /📋 第 1 步 — 复制以下提示词发给开发 AI：/);
  assert.ok(step.indexOf("```text") < step.indexOf("【🚧 边界条件】"));
  assert.ok(step.indexOf("【🚧 边界条件】") < step.indexOf("【✅ 验收标准】"));
  assert.ok(step.indexOf("【✅ 验收标准】") < step.indexOf("第 2 步 — 人工验收清单"));
  assert.ok(step.indexOf("第 2 步 — 人工验收清单") < step.indexOf("第 3 步 — 回复"));
  assert.deepEqual(validateRoadmap(envelope).errors, []);
});

test("requires the manual checklist to exactly match prompt acceptance criteria", () => {
  const envelope = makeEnvelope();
  envelope.markdown = envelope.markdown.replace(
    "- [ ] 打开结果并确认核心内容正确。",
    "- [ ] 检查一个提示词里没有的新项目。",
  );
  const result = validateRoadmap(envelope);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /逐项一致/);
});

test("requires the reply command to use the visible substep label", () => {
  const envelope = makeEnvelope({
    steps: [makeStep({ label: "4-3b" })],
  });
  assert.deepEqual(validateRoadmap(envelope).errors, []);
  envelope.markdown = envelope.markdown.replace("4-3b 通过，请继续。", "其他步骤通过");
  const result = validateRoadmap(envelope);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /4-3b 通过，请继续/);
});

test("rejects the old format when boundaries and acceptance are outside the prompt code block", () => {
  const envelope = makeEnvelope();
  envelope.markdown = envelope.markdown
    .replace("\n【🚧 边界条件】", "\n```\n\n【🚧 边界条件】")
    .replace("\n```\n\n<!-- IR_STEP_END -->", "\n<!-- IR_STEP_END -->");
  const result = validateRoadmap(envelope);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /顺序必须为|只有一个|恰好包含/);
});

test("rejects more than two user acceptance checks", () => {
  const envelope = makeEnvelope({
    steps: [makeStep({ acceptance: ["一", "二", "三"] })],
  });
  const result = validateRoadmap(envelope);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /1–2/);
});

test("rejects backend-first ordering for a no-code frontend project", () => {
  const envelope = makeEnvelope({
    hasFrontend: true,
    steps: [makeStep({ kind: "backend", evidence: "report", data: "real" })],
  });
  assert.equal(validateRoadmap(envelope).valid, false);
  assert.match(validateRoadmap(envelope).errors.join("\n"), /frontend \+ ui/);
});

test("rejects mock data without later real UI integration", () => {
  const envelope = makeEnvelope({
    hasFrontend: true,
    steps: [makeStep({ kind: "frontend", evidence: "ui", data: "mock" })],
  });
  assert.equal(validateRoadmap(envelope).valid, false);
  assert.match(validateRoadmap(envelope).errors.join("\n"), /真实 UI 集成/);
});

test("preserves completed steps byte-for-byte during update", () => {
  const completed = makeStep({
    id: "step-01",
    status: "completed",
    kind: "report",
    evidence: "report",
    title: "已经完成且不能改写",
  });
  const oldRoadmap = makeEnvelope({
    steps: [completed, makeStep({ id: "step-02" })],
  }).markdown;
  const incoming = makeEnvelope({
    action: "update",
    steps: [
      makeStep({ id: "step-01", status: "completed", title: "错误改写" }),
      makeStep({ id: "step-02", title: "新的未完成步骤" }),
    ],
  }).markdown;
  const merged = mergeCompletedSteps(oldRoadmap, incoming);
  assert.ok(merged.includes(completed));
  assert.ok(!merged.includes("错误改写"));
  assert.ok(merged.includes("新的未完成步骤"));
});

test("requires every completed step to remain in an update", () => {
  const oldRoadmap = makeEnvelope({
    steps: [
      makeStep({ id: "step-01" }),
      makeStep({ id: "step-02", status: "completed" }),
    ],
  }).markdown;
  const incoming = makeEnvelope({ action: "update", steps: [makeStep()] }).markdown;
  assert.throws(() => mergeCompletedSteps(oldRoadmap, incoming), /已完成步骤 step-02|已完成步骤/);
});

test("archives a previous target before atomically writing a new target", (t) => {
  const root = temporaryProject(t);
  const first = makeEnvelope({ goal: "旧目标" });
  persistRoadmap({ projectRoot: root, envelope: first, now: new Date("2026-01-02T03:04:05") });
  const second = makeEnvelope({ goal: "新目标" });
  const result = persistRoadmap({ projectRoot: root, envelope: second, now: new Date("2026-02-03T04:05:06") });
  assert.ok(result.archive);
  assert.ok(fs.existsSync(result.archive));
  assert.match(fs.readFileSync(result.archive, "utf8"), /旧目标/);
  assert.match(fs.readFileSync(path.join(root, "IDIOTS_ROADMAP.md"), "utf8"), /新目标/);
});

test("keeps the existing file when update goal does not match", (t) => {
  const root = temporaryProject(t);
  const first = makeEnvelope({ goal: "目标 A" });
  persistRoadmap({ projectRoot: root, envelope: first });
  const before = fs.readFileSync(path.join(root, "IDIOTS_ROADMAP.md"), "utf8");
  const wrong = makeEnvelope({ action: "update", goal: "目标 B" });
  assert.throws(() => persistRoadmap({ projectRoot: root, envelope: wrong }), /goal/);
  assert.equal(fs.readFileSync(path.join(root, "IDIOTS_ROADMAP.md"), "utf8"), before);
});

test("rejects a Roadmap target symlink that points outside the project", (t) => {
  const root = temporaryProject(t);
  const outside = path.join(os.tmpdir(), `idiots-roadmap-outside-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(outside, "outside", "utf8");
  t.after(() => fs.rmSync(outside, { force: true }));
  try {
    fs.symlinkSync(outside, path.join(root, "IDIOTS_ROADMAP.md"), "file");
  } catch (error) {
    if (["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) {
      t.skip("This Windows environment does not permit symlink creation.");
      return;
    }
    throw error;
  }
  assert.throws(() => resolveSafePaths(root), /符号链接/);
});

test("parses opt-out and enabled envelopes", () => {
  assert.equal(parseEnvelope("plan\n<!-- IDIOTS_ROADMAP:OPTOUT -->").type, "optout");
  assert.equal(parseEnvelope(makeEnvelope().text).type, "roadmap");
});
