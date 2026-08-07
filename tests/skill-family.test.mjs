import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { persistRoadmap } from "../hooks/lib/roadmap.mjs";
import { makeProjectState, makeV3Envelope } from "./helpers/project-state-fixture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function temporaryProject(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-family-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function runRuntime(projectRoot, ...args) {
  return spawnSync(
    process.execPath,
    [path.join(projectRoot, ".idiotsroadmap", "runtime", "roadmap-state.mjs"), ...args],
    { cwd: projectRoot, encoding: "utf8" },
  );
}

function runPortable(projectRoot, ...args) {
  return spawnSync(
    process.execPath,
    [path.join(root, "skills", "idiots-roadmap", "scripts", "roadmap-state.mjs"), ...args],
    { cwd: projectRoot, encoding: "utf8" },
  );
}

test("ships four focused Skills without scaffold placeholders", () => {
  const names = ["idiots-roadmap", "idiots-roadmap-start", "idiots-roadmap-finish", "idiots-roadmap-align"];
  for (const name of names) {
    const skill = fs.readFileSync(path.join(root, "skills", name, "SKILL.md"), "utf8");
    const ui = fs.readFileSync(path.join(root, "skills", name, "agents", "openai.yaml"), "utf8");
    assert.match(skill, new RegExp(`^name: ${name}$`, "mu"));
    assert.doesNotMatch(skill, /\[TODO:/u);
    assert.match(ui, new RegExp(`\\$${name}`, "u"));
  }
  const planner = fs.readFileSync(path.join(root, "skills", "idiots-roadmap", "SKILL.md"), "utf8");
  const starter = fs.readFileSync(path.join(root, "skills", "idiots-roadmap-start", "SKILL.md"), "utf8");
  assert.match(planner, /repository\.githubMode/);
  assert.match(planner, /创建新的私人 GitHub 仓库/);
  assert.match(starter, /准备版本保护/);
  assert.match(starter, /不得改成公开仓库/);
  assert.match(starter, /manual-after-final-acceptance/);
});

test("hookless bootstrap creates the first proposed Roadmap and installs project runtime", (t) => {
  const project = temporaryProject(t);
  const control = path.join(project, ".idiotsroadmap");
  fs.mkdirSync(control);
  const candidate = path.join(control, "initial-state.json");
  fs.writeFileSync(candidate, JSON.stringify(makeProjectState()), "utf8");

  const result = runPortable(project, "bootstrap", candidate, project);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output, { action: "bootstrapped", revision: 1, approval: "proposed", stop: true });
  assert.equal(fs.existsSync(candidate), false);
  assert.equal(fs.existsSync(path.join(project, "IDIOTS_ROADMAP.md")), true);
  assert.equal(fs.existsSync(path.join(control, "runtime", "roadmap-state.mjs")), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(control, "state.json"), "utf8")).current.approval.status, "proposed");
});

test("hookless bootstrap refuses to overwrite an existing Roadmap", (t) => {
  const project = temporaryProject(t);
  const firstControl = path.join(project, ".idiotsroadmap");
  fs.mkdirSync(firstControl);
  const firstCandidate = path.join(firstControl, "initial-state.json");
  fs.writeFileSync(firstCandidate, JSON.stringify(makeProjectState()), "utf8");
  assert.equal(runPortable(project, "bootstrap", firstCandidate, project).status, 0);
  const before = fs.readFileSync(path.join(firstControl, "state.json"), "utf8");

  const secondCandidate = path.join(firstControl, "initial-state.json");
  const replacement = makeProjectState();
  replacement.goal.summary = "不应该覆盖的新目标";
  fs.writeFileSync(secondCandidate, JSON.stringify(replacement), "utf8");
  const result = runPortable(project, "bootstrap", secondCandidate, project);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /已经存在 V3 Roadmap/);
  assert.equal(fs.readFileSync(path.join(firstControl, "state.json"), "utf8"), before);
  assert.equal(fs.existsSync(secondCandidate), true);
});

test("hookless bootstrap cannot pre-approve the first development batch", (t) => {
  const project = temporaryProject(t);
  const control = path.join(project, ".idiotsroadmap");
  fs.mkdirSync(control);
  const candidate = path.join(control, "initial-state.json");
  const forged = makeProjectState();
  forged.current.approval.status = "approved";
  forged.current.approval.approvedAtRevision = 1;
  forged.workItems[0].status = "ready";
  fs.writeFileSync(candidate, JSON.stringify(forged), "utf8");

  const result = runPortable(project, "bootstrap", candidate, project);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /第一批必须等待用户批准/);
  assert.equal(fs.existsSync(path.join(control, "state.json")), false);
  assert.equal(fs.existsSync(path.join(project, "IDIOTS_ROADMAP.md")), false);
});

test("a proposed batch cannot be claimed before explicit approval", (t) => {
  const project = temporaryProject(t);
  persistRoadmap({ projectRoot: project, envelope: makeV3Envelope() });

  const early = runRuntime(project, "claim");
  assert.equal(early.status, 1);
  assert.match(early.stderr, /尚未得到用户批准/);

  const approved = runRuntime(project, "approve");
  assert.equal(approved.status, 0, approved.stderr);
  const approvedState = JSON.parse(fs.readFileSync(path.join(project, ".idiotsroadmap", "state.json"), "utf8"));
  assert.equal(approvedState.current.approval.status, "approved");
  assert.equal(approvedState.workItems[0].status, "ready");
  assert.match(fs.readFileSync(path.join(project, "IDIOTS_ROADMAP.md"), "utf8"), /\$idiots-roadmap-start/);

  const claimed = runRuntime(project, "claim");
  assert.equal(claimed.status, 0, claimed.stderr);
  const claimResult = JSON.parse(claimed.stdout);
  assert.equal(claimResult.workItemId, "work_page");
  assert.match(claimResult.claimId, /^claim_/u);
  const claimedState = JSON.parse(fs.readFileSync(path.join(project, ".idiotsroadmap", "state.json"), "utf8"));
  assert.equal(claimedState.workItems[0].status, "in_progress");

  const duplicate = runRuntime(project, "claim");
  assert.equal(duplicate.status, 1);
  assert.match(duplicate.stderr, /没有可领取的工作/);
});

test("ordinary candidate apply cannot forge user approval", (t) => {
  const project = temporaryProject(t);
  persistRoadmap({ projectRoot: project, envelope: makeV3Envelope() });
  const candidate = makeProjectState({ revision: 2, baseRevision: 1 });
  candidate.current.approval.status = "approved";
  candidate.current.approval.approvedAtRevision = 2;
  candidate.workItems[0].status = "ready";
  const candidateFile = path.join(project, ".idiotsroadmap", "next-state.json");
  fs.writeFileSync(candidateFile, JSON.stringify(candidate), "utf8");

  const result = runRuntime(project, "apply", candidateFile, project);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /只有用户明确批准/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(project, ".idiotsroadmap", "state.json"), "utf8")).revision, 1);
});

test("changing an approved user result forces a new proposal", (t) => {
  const project = temporaryProject(t);
  persistRoadmap({ projectRoot: project, envelope: makeV3Envelope() });
  assert.equal(runRuntime(project, "approve").status, 0);
  const current = JSON.parse(fs.readFileSync(path.join(project, ".idiotsroadmap", "state.json"), "utf8"));
  const candidate = structuredClone(current);
  candidate.baseRevision = current.revision;
  candidate.revision += 1;
  candidate.workItems[0].outcome = "改变成另一个用户结果";
  const candidateFile = path.join(project, ".idiotsroadmap", "next-state.json");
  fs.writeFileSync(candidateFile, JSON.stringify(candidate), "utf8");

  const result = runRuntime(project, "apply", candidateFile, project);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /必须重新交给用户批准/);
});

test("parallel Start sessions atomically claim different approved work", (t) => {
  const project = temporaryProject(t);
  const state = makeProjectState();
  state.modules.push({
    id: "mod_data",
    name: "清单数据",
    responsibility: "读取清单数据",
    nonResponsibilities: ["页面布局"],
    files: ["src/data/**"],
    userOutcome: "页面可以读取真实清单",
    evidence: [],
  });
  state.workItems[0].execution = "parallel";
  state.workItems.push({
    ...structuredClone(state.workItems[0]),
    id: "work_data",
    title: "读取清单数据",
    outcome: "真实清单数据可以提供给页面",
    kind: "backend",
    moduleIds: ["mod_data"],
    files: ["src/data/**"],
    completion: { authority: "ai-review", acceptance: [], review: { status: "pending", summary: "" } },
  });
  state.workItems.push({
    ...structuredClone(state.workItems[0]),
    id: "work_integration",
    title: "整合页面和清单数据",
    outcome: "通过页面操作真实清单",
    kind: "integration",
    status: "planned",
    batch: 2,
    execution: "serial",
    moduleIds: ["mod_page", "mod_data"],
    dependsOn: ["work_page", "work_data"],
    files: ["src/integration/**"],
    session: { strategy: "serial", baseCommit: "0123456", prompt: "" },
  });
  state.current.workItemIds = ["work_page", "work_data"];
  state.current.approval.workItemIds = ["work_page", "work_data"];
  state.current.approval.visibleResults = ["页面和数据可以分别完成，为后续整合做好准备"];
  persistRoadmap({ projectRoot: project, envelope: makeV3Envelope(state) });
  assert.equal(runRuntime(project, "approve").status, 0);

  const first = runRuntime(project, "claim");
  const second = runRuntime(project, "claim");
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.notEqual(JSON.parse(first.stdout).workItemId, JSON.parse(second.stdout).workItemId);
});
