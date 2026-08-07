import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parseEnvelope, persistRoadmap, validateRoadmap } from "../hooks/lib/roadmap.mjs";
import { APPLY_COMMAND, HANDOFF_GUARD, renderRoadmap, validateProjectState } from "../hooks/lib/project-state.mjs";
import { makeProjectState, makeV3Envelope } from "./helpers/project-state-fixture.mjs";
import { makeEnvelope, makeStep } from "./helpers/roadmap-fixture.mjs";

function temporaryProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-v3-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("parses and validates a V3 state envelope", () => {
  const parsed = parseEnvelope(makeV3Envelope().text);
  assert.equal(parsed.projectState.schemaVersion, 3);
  assert.equal(validateRoadmap(parsed).valid, true);
});

test("renders one compact user document and keeps technical state separate", (t) => {
  const root = temporaryProject(t);
  const result = persistRoadmap({ projectRoot: root, envelope: makeV3Envelope() });
  const roadmap = fs.readFileSync(result.target, "utf8");
  const state = JSON.parse(fs.readFileSync(path.join(root, ".idiotsroadmap", "state.json"), "utf8"));
  assert.match(roadmap, /现在需要你做什么/);
  assert.match(roadmap, /开始下一轮/);
  assert.doesNotMatch(roadmap, /复制到新的开发 Session/);
  assert.match(roadmap, /需要你亲自体验/);
  assert.doesNotMatch(roadmap, /刷新后的保存行为尚未验证/);
  assert.equal(state.project.analysis.unresolved.length, 1);
});

test("renders plain Git and GitHub guidance for an uninitialized project", () => {
  const state = makeProjectState();
  state.repository = {
    ...state.repository,
    isGitRepo: false,
    workingTree: "unknown",
    currentBranch: null,
    remoteProvider: "none",
    remoteName: null,
    githubMode: "create-private",
    workspaceStrategy: null,
    baseCommit: null,
  };
  state.project.analysis.baseCommit = null;
  state.workItems[0].session = { strategy: "serial", baseCommit: null, prompt: "" };

  const validation = validateProjectState(state, makeV3Envelope(state).metadata);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  const roadmap = renderRoadmap(state);
  assert.match(roadmap, /第一轮开始前由 AI 建立/);
  assert.match(roadmap, /已选择创建私人仓库/);
  assert.doesNotMatch(roadmap, /git init|gh repo/u);
});

test("new Roadmaps remember the GitHub choice while old V3 states remain readable", () => {
  const state = makeProjectState();
  delete state.repository.githubMode;
  assert.equal(validateProjectState(state).valid, true);
  const validation = validateProjectState(state, makeV3Envelope(state).metadata);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /必须记录 repository\.githubMode/);
});

test("awaiting user experience hides the development prompt", () => {
  const state = makeProjectState();
  state.workItems[0].status = "awaiting_user";
  state.current.approval.status = "approved";
  state.current.approval.approvedAtRevision = 1;
  state.workItems[0].session.prompt = "";
  state.workItems[0].completion.review = { status: "passed", summary: "技术检查完成" };
  assert.equal(validateProjectState(state).valid, true);
  const roadmap = renderRoadmap(state);
  assert.match(roadmap, /不用打开新 Session/);
  assert.match(roadmap, /等待用户体验/);
  assert.doesNotMatch(roadmap, /复制到新的开发 Session/);
});

test("future work cannot contain a prewritten full prompt", () => {
  const state = makeProjectState();
  state.project.hasFrontend = false;
  state.workItems.push({
    ...structuredClone(state.workItems[0]),
    id: "work_future",
    title: "未来工作",
    batch: 2,
    dependsOn: ["work_page"],
    session: { ...state.workItems[0].session, prompt: "过早写好的完整提示词" },
  });
  const validation = validateProjectState(state);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /不在当前批次，不得预写/);
});

test("AI review work has no human acceptance checklist", () => {
  const state = makeProjectState();
  state.project.hasFrontend = false;
  state.workItems[0].completion = {
    authority: "ai-review",
    acceptance: [],
    review: { status: "pending", summary: "" },
  };
  const validation = validateProjectState(state);
  assert.equal(validation.valid, true);
  const roadmap = renderRoadmap(state);
  assert.match(roadmap, /独立复核 Agent/);
  assert.doesNotMatch(roadmap, /需要你亲自体验/);
});

test("completed technical work renders one-line agreement without a user checklist", () => {
  const state = makeProjectState();
  state.workItems[0].status = "technical_verified";
  state.workItems[0].session.prompt = "";
  state.workItems[0].completion = {
    authority: "ai-review",
    acceptance: [],
    review: { status: "passed", summary: "独立复核一致" },
  };
  state.current = { batch: null, workItemIds: [] };
  state.milestones[0].status = "completed";
  const validation = validateProjectState(state);
  assert.equal(validation.valid, true);
  const roadmap = renderRoadmap(state);
  assert.match(roadmap, /本轮目标已经完成/);
  assert.match(roadmap, /AI 技术复核一致/);
  assert.doesNotMatch(roadmap, /需要你亲自体验/);
});

test("rejects technical acceptance in no-code mode", () => {
  const state = makeProjectState();
  state.workItems[0].completion.acceptance = ["查看测试报告，确认全部通过。"];
  const validation = validateProjectState(state);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /无代码验收包含技术判断/);
});

test("requires a visible first batch for no-code frontend projects", () => {
  const state = makeProjectState();
  state.workItems[0].kind = "backend";
  state.workItems[0].completion = {
    authority: "ai-review",
    acceptance: [],
    review: { status: "pending", summary: "" },
  };
  assert.match(validateProjectState(state).errors.join("\n"), /首批必须包含可直接体验的前端结果/);
});

test("mock UI work requires a later real user experience", () => {
  const state = makeProjectState();
  state.workItems[0].dataMode = "mock";
  assert.match(validateProjectState(state).errors.join("\n"), /必须安排同一模块的真实集成体验/);

  state.workItems.push({
    ...structuredClone(state.workItems[0]),
    id: "work_real",
    title: "接入真实清单数据",
    kind: "integration",
    dataMode: "real",
    status: "planned",
    batch: 2,
    dependsOn: ["work_page"],
    files: ["src/integration/**"],
    session: { strategy: "serial", baseCommit: "0123456", prompt: "" },
  });
  assert.equal(validateProjectState(state).valid, true);
});

test("code readers must declare their allowed languages", () => {
  const state = makeProjectState();
  state.capability = { mode: "code-reader", description: "能看基础代码" };
  assert.match(validateProjectState(state).errors.join("\n"), /必须明确允许阅读的语言/);
  state.capability.languages = ["TypeScript", "CSS"];
  assert.equal(validateProjectState(state).valid, true);
});

test("stale V3 revision cannot overwrite current state", (t) => {
  const root = temporaryProject(t);
  persistRoadmap({ projectRoot: root, envelope: makeV3Envelope() });
  const updated = makeProjectState({ revision: 2, baseRevision: 1 });
  updated.project.analysis.summary = "重新分析后确认页面可打开。";
  persistRoadmap({ projectRoot: root, envelope: makeV3Envelope(updated, "update") });
  const stale = makeProjectState({ revision: 2, baseRevision: 1 });
  assert.throws(
    () => persistRoadmap({ projectRoot: root, envelope: makeV3Envelope(stale, "update") }),
    /已更新到 revision 2/,
  );
});

test("accepted work and user decisions are immutable", (t) => {
  const root = temporaryProject(t);
  const accepted = makeProjectState();
  accepted.workItems[0].status = "accepted";
  accepted.workItems[0].session.prompt = "";
  accepted.workItems[0].completion.review = { status: "passed", summary: "技术复核完成" };
  accepted.current = { batch: null, workItemIds: [] };
  accepted.milestones[0].status = "completed";
  accepted.decisions = [{ id: "decision_001", source: "user", summary: "保持单人模式" }];
  persistRoadmap({ projectRoot: root, envelope: makeV3Envelope(accepted) });

  const changed = structuredClone(accepted);
  changed.revision = 2;
  changed.baseRevision = 1;
  changed.workItems[0].outcome = "被旧 Session 改写";
  assert.throws(
    () => persistRoadmap({ projectRoot: root, envelope: makeV3Envelope(changed, "update") }),
    /不得删除或改写/,
  );
});

test("validates isolated parallel work followed by one integration item", () => {
  const state = makeProjectState();
  state.modules.push({
    id: "mod_data",
    name: "清单数据",
    responsibility: "保存和读取清单项目",
    nonResponsibilities: ["页面布局"],
    files: ["src/data/**"],
    userOutcome: "刷新后仍保留清单状态",
    evidence: [],
  });
  state.contracts.push({
    id: "ctr_record",
    name: "清单记录",
    version: "1",
    provider: "mod_data",
    consumers: ["mod_page"],
    kind: "data",
    summary: "页面读取清单标题和完成状态",
    compatibility: "新增可选字段保持兼容",
    evidence: [],
  });
  state.workItems[0].execution = "parallel";
  state.workItems[0].contractIds = ["ctr_record"];
  state.workItems.push({
    ...structuredClone(state.workItems[0]),
    id: "work_data",
    title: "实现清单读取",
    outcome: "按合同提供真实清单数据",
    kind: "backend",
    moduleIds: ["mod_data"],
    files: ["src/data/**"],
    session: { ...structuredClone(state.workItems[0].session), prompt: "" },
    completion: {
      authority: "ai-review",
      acceptance: [],
      review: { status: "pending", summary: "" },
    },
  });
  state.workItems.push({
    ...structuredClone(state.workItems[0]),
    id: "work_integrate",
    title: "整合页面与真实数据",
    outcome: "通过同一页面操作真实清单",
    kind: "integration",
    status: "planned",
    moduleIds: ["mod_page", "mod_data"],
    batch: 2,
    execution: "serial",
    dependsOn: ["work_page", "work_data"],
    files: ["src/integration/**"],
    session: { strategy: "serial", baseCommit: "0123456", prompt: "" },
  });
  state.current.workItemIds = ["work_page", "work_data"];
  state.current.approval.workItemIds = ["work_page", "work_data"];
  state.current.approval.visibleResults = ["可以操作清单页面", "清单数据可以真实读取"];
  assert.equal(validateProjectState(state).valid, true);

  state.workItems[1].files = ["src/list/detail/**"];
  assert.match(validateProjectState(state).errors.join("\n"), /文件范围重叠/);
});

test("renders a compact impact summary for an active contract change", () => {
  const state = makeProjectState();
  state.changes.push({
    id: "chg_record001",
    kind: "contract-change",
    status: "active",
    summary: "清单项目增加可选截止日期。",
    affectedModules: ["mod_page"],
    affectedContracts: [],
    unaffected: ["账号流程"],
    decisionNeeded: "",
  });
  assert.equal(validateProjectState(state).valid, true);
  const roadmap = renderRoadmap(state);
  assert.match(roadmap, /清单项目增加可选截止日期/);
  assert.match(roadmap, /不受影响：账号流程/);
});

test("migrates a legacy Roadmap without overwriting it before validation", (t) => {
  const root = temporaryProject(t);
  persistRoadmap({ projectRoot: root, envelope: makeEnvelope() });
  const state = makeProjectState({ migration: { fromVersion: 1 } });
  const result = persistRoadmap({ projectRoot: root, envelope: makeV3Envelope(state, "update") });
  assert.equal(result.transition, "migration");
  assert.ok(result.archive);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, ".idiotsroadmap", "state.json"), "utf8")).schemaVersion, 3);
});

test("legacy completed history must be represented before V3 migration", (t) => {
  const root = temporaryProject(t);
  persistRoadmap({
    projectRoot: root,
    envelope: makeEnvelope({ steps: [makeStep({ status: "completed", title: "旧完成结果" })] }),
  });
  const target = path.join(root, "IDIOTS_ROADMAP.md");
  const before = fs.readFileSync(target, "utf8");
  const missing = makeProjectState({ migration: { fromVersion: 1 } });
  missing.workItems[0].status = "accepted";
  missing.workItems[0].session.prompt = "";
  missing.workItems[0].completion.review = { status: "passed", summary: "技术复核完成" };
  missing.current = { batch: null, workItemIds: [] };
  missing.milestones[0].status = "completed";
  assert.throws(
    () => persistRoadmap({ projectRoot: root, envelope: makeV3Envelope(missing, "update") }),
    /迁移缺少旧已完成步骤 step-01/,
  );
  assert.equal(fs.readFileSync(target, "utf8"), before);

  const represented = structuredClone(missing);
  represented.workItems[0].legacyStepId = "step-01";
  persistRoadmap({ projectRoot: root, envelope: makeV3Envelope(represented, "update") });
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, ".idiotsroadmap", "state.json"), "utf8")).workItems[0].legacyStepId, "step-01");
});

test("archives both user Roadmap and machine state before a new goal", (t) => {
  const root = temporaryProject(t);
  persistRoadmap({ projectRoot: root, envelope: makeV3Envelope() });
  const next = makeProjectState({ roadmapId: "rm_second001" });
  next.goal.summary = "建立新的项目目标";
  next.goal.success = "新目标拥有独立状态";
  const result = persistRoadmap({ projectRoot: root, envelope: makeV3Envelope(next, "new") });
  assert.equal(result.transition, "new-goal");
  assert.ok(fs.existsSync(result.archive));
  assert.ok(fs.existsSync(result.archive.replace(/\.md$/u, ".state.json")));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, ".idiotsroadmap", "state.json"), "utf8")).roadmapId, "rm_second001");
});

test("state CLI applies a checked revision and regenerates the user document", (t) => {
  const root = temporaryProject(t);
  persistRoadmap({ projectRoot: root, envelope: makeV3Envelope() });
  const candidate = makeProjectState({ revision: 2, baseRevision: 1 });
  candidate.project.analysis.summary = "重新分析后确认页面入口存在。";
  const candidatePath = path.join(root, ".idiotsroadmap", "next-state.json");
  fs.writeFileSync(candidatePath, JSON.stringify(candidate), "utf8");
  const result = spawnSync(
    process.execPath,
    [path.join(root, ".idiotsroadmap", "runtime", "roadmap-state.mjs"), "apply", candidatePath, root],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Applied revision 2/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, ".idiotsroadmap", "state.json"), "utf8")).revision, 2);
  assert.equal(fs.existsSync(candidatePath), false);
});

test("a long Session chain keeps the goal stable and the user document compact", (t) => {
  const root = temporaryProject(t);
  let state = makeProjectState();
  state.goal.summary = "稳定完成十个技术交付";
  state.goal.success = "十个技术交付全部经过独立复核";
  state.project.hasFrontend = false;
  state.workItems = Array.from({ length: 10 }, (_, index) => ({
    id: `work_tech${String(index + 1).padStart(2, "0")}`,
    title: `技术任务 ${index + 1}`,
    outcome: `完成第 ${index + 1} 个独立技术结果`,
    kind: "other",
    dataMode: "none",
    status: index === 0 ? "in_progress" : "planned",
    milestoneId: "ms_basic",
    moduleIds: ["mod_page"],
    contractIds: [],
    batch: index + 1,
    execution: "serial",
    dependsOn: index === 0 ? [] : [`work_tech${String(index).padStart(2, "0")}`],
    files: [`src/part-${index + 1}/**`],
    session: {
      strategy: "serial",
      baseCommit: "0123456",
      prompt: index === 0 ? `只完成技术任务 1，复核后写入候选状态，运行 ${APPLY_COMMAND} 并停止。\n${HANDOFF_GUARD}` : "",
    },
    completion: {
      authority: "ai-review",
      acceptance: [],
      review: { status: "pending", summary: "" },
    },
  }));
  state.current = { batch: 1, workItemIds: ["work_tech01"] };
  persistRoadmap({ projectRoot: root, envelope: makeV3Envelope(state) });

  for (let index = 0; index < 10; index += 1) {
    if (state.workItems[index].status === "ready") {
      const started = structuredClone(state);
      started.revision += 1;
      started.baseRevision = state.revision;
      started.workItems[index].status = "in_progress";
      persistRoadmap({ projectRoot: root, envelope: makeV3Envelope(started, "update") });
      state = started;
    }

    const completed = structuredClone(state);
    completed.revision += 1;
    completed.baseRevision = state.revision;
    completed.workItems[index].status = "technical_verified";
    completed.workItems[index].session.prompt = "";
    completed.workItems[index].completion.review = { status: "passed", summary: "独立复核一致" };
    if (index + 1 < completed.workItems.length) {
      completed.workItems[index + 1].status = "ready";
      completed.workItems[index + 1].session.prompt = `只完成技术任务 ${index + 2}，复核后写入候选状态，运行 ${APPLY_COMMAND} 并停止。\n${HANDOFF_GUARD}`;
      completed.current = { batch: index + 2, workItemIds: [completed.workItems[index + 1].id] };
    } else {
      completed.current = { batch: null, workItemIds: [] };
      completed.milestones[0].status = "completed";
    }
    persistRoadmap({ projectRoot: root, envelope: makeV3Envelope(completed, "update") });
    state = completed;
  }

  const saved = JSON.parse(fs.readFileSync(path.join(root, ".idiotsroadmap", "state.json"), "utf8"));
  const roadmap = fs.readFileSync(path.join(root, "IDIOTS_ROADMAP.md"), "utf8");
  assert.equal(saved.goal.summary, "稳定完成十个技术交付");
  assert.equal(saved.workItems.filter((item) => item.status === "technical_verified").length, 10);
  assert.doesNotMatch(roadmap, /技术任务 1\n/);
  assert.ok(Buffer.byteLength(roadmap, "utf8") < 6000);
});
