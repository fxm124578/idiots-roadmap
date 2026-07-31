import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  classifyRoadmapTransition,
  mergeCompletedSteps,
  parseSteps,
  persistRoadmap,
  validateRoadmap,
} from "../hooks/lib/roadmap.mjs";
import { makeEnvelope, makeStep } from "./helpers/roadmap-fixture.mjs";

const NO_CODE = { mode: "no-code", description: "完全不看代码" };
const PYTHON_READER = {
  mode: "code-reader",
  description: "能看 Python 基础代码",
  languages: ["python"],
};

function temporaryProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-roadmap-state-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function makeV2Envelope({
  roadmapId = "rm_state0001",
  revision = 1,
  baseRevision = null,
  action = "new",
  capability = NO_CODE,
  goal = "可靠更新计划",
  steps,
} = {}) {
  return makeEnvelope({
    version: 2,
    roadmapId,
    revision,
    baseRevision,
    action,
    capabilityMode: capability.mode,
    capabilityDescription: capability.description,
    capabilityLanguages: capability.languages,
    goal,
    steps,
  });
}

function stateStep({
  id,
  label,
  batch,
  status = "pending",
  capability = NO_CODE,
  title,
  evidence = "report",
} = {}) {
  return makeStep({
    id,
    label,
    displayOrder: batch,
    batch,
    status,
    createdUnderCapability: capability,
    title,
    evidence,
  });
}

test("classifies absent, new, update, new-goal and recovery transitions", () => {
  const current = makeV2Envelope({
    steps: [stateStep({ id: "step-alpha", label: "1", batch: 1 })],
  });
  const stored = `<!-- IR_STORED_META ${JSON.stringify(current.metadata)} -->\n${current.markdown}`;
  assert.equal(classifyRoadmapTransition(), "absent");
  assert.equal(
    classifyRoadmapTransition({ incomingMetadata: current.metadata }),
    "new",
  );
  assert.equal(
    classifyRoadmapTransition({
      oldMarkdown: stored,
      incomingMetadata: {
        ...current.metadata,
        action: "update",
        revision: 2,
        baseRevision: 1,
      },
    }),
    "update",
  );
  assert.equal(
    classifyRoadmapTransition({
      oldMarkdown: stored,
      incomingMetadata: {
        ...current.metadata,
        roadmapId: "rm_newgoal01",
        goal: "另一个目标",
      },
    }),
    "new-goal",
  );
  assert.equal(
    classifyRoadmapTransition({
      oldMarkdown: stored,
      incomingMetadata: { ...current.metadata, action: "update", goal: "错误目标" },
    }),
    "recovery",
  );
});

test("keeps repeated V1 hook delivery idempotent for compatibility", (t) => {
  const root = temporaryProject(t);
  const legacy = makeEnvelope();
  persistRoadmap({ projectRoot: root, envelope: legacy });
  const repeated = persistRoadmap({ projectRoot: root, envelope: legacy });
  assert.equal(repeated.unchanged, true);
  assert.equal(
    fs.readdirSync(path.join(root, ".idiotsroadmap", "archive")).length,
    0,
  );
});

test("uses stable IDs while inserting and reordering unfinished steps", (t) => {
  const root = temporaryProject(t);
  const first = makeV2Envelope({
    capability: PYTHON_READER,
    steps: [
      stateStep({
        id: "step-alpha",
        label: "1",
        batch: 1,
        status: "completed",
        capability: PYTHON_READER,
        title: "已经看过的结果",
        evidence: "code",
      }),
      stateStep({
        id: "step-omega",
        label: "3",
        batch: 3,
        capability: PYTHON_READER,
        title: "稍后处理",
      }),
    ],
  });
  assert.deepEqual(validateRoadmap(first).errors, []);
  persistRoadmap({ projectRoot: root, envelope: first });

  const update = makeV2Envelope({
    action: "update",
    revision: 2,
    baseRevision: 1,
    capability: NO_CODE,
    steps: [
      stateStep({
        id: "step-alpha",
        label: "1",
        batch: 1,
        status: "completed",
        capability: PYTHON_READER,
        title: "不应覆盖旧内容",
        evidence: "code",
      }),
      stateStep({
        id: "step-beta",
        label: "2",
        batch: 2,
        capability: NO_CODE,
        title: "新插入的步骤",
      }),
      stateStep({
        id: "step-omega",
        label: "3",
        batch: 3,
        capability: NO_CODE,
        title: "按新能力重写",
      }),
    ],
  });
  persistRoadmap({ projectRoot: root, envelope: update });
  const saved = fs.readFileSync(path.join(root, "IDIOTS_ROADMAP.md"), "utf8");
  const savedSteps = parseSteps(saved);
  assert.deepEqual(
    savedSteps.map((step) => step.metadata.id),
    ["step-alpha", "step-beta", "step-omega"],
  );
  assert.match(savedSteps[0].raw, /已经看过的结果/);
  assert.doesNotMatch(savedSteps[0].raw, /不应覆盖旧内容/);
  assert.deepEqual(savedSteps[0].metadata.createdUnderCapability, PYTHON_READER);
  assert.deepEqual(savedSteps[1].metadata.createdUnderCapability, NO_CODE);
});

test("allows deleting unfinished steps but never reuses their IDs", (t) => {
  const root = temporaryProject(t);
  const first = makeV2Envelope({
    steps: [
      stateStep({ id: "step-alpha", label: "1", batch: 1 }),
      stateStep({ id: "step-beta", label: "2", batch: 2 }),
      stateStep({ id: "step-gamma", label: "3", batch: 3 }),
    ],
  });
  persistRoadmap({ projectRoot: root, envelope: first });
  const withoutBeta = makeV2Envelope({
    action: "update",
    revision: 2,
    baseRevision: 1,
    steps: [
      stateStep({ id: "step-alpha", label: "1", batch: 1 }),
      stateStep({ id: "step-gamma", label: "2", batch: 2 }),
    ],
  });
  persistRoadmap({ projectRoot: root, envelope: withoutBeta });

  const reusedBeta = makeV2Envelope({
    action: "update",
    revision: 3,
    baseRevision: 2,
    steps: [
      stateStep({ id: "step-alpha", label: "1", batch: 1 }),
      stateStep({ id: "step-beta", label: "2", batch: 2, title: "错误复用" }),
      stateStep({ id: "step-gamma", label: "3", batch: 3 }),
    ],
  });
  assert.throws(
    () => persistRoadmap({ projectRoot: root, envelope: reusedBeta }),
    /已经使用过|不能复用/,
  );
});

test("rejects stale sessions without changing the newest Roadmap", (t) => {
  const root = temporaryProject(t);
  persistRoadmap({
    projectRoot: root,
    envelope: makeV2Envelope({
      steps: [stateStep({ id: "step-alpha", label: "1", batch: 1 })],
    }),
  });
  const newest = makeV2Envelope({
    action: "update",
    revision: 2,
    baseRevision: 1,
    steps: [
      stateStep({
        id: "step-alpha",
        label: "1",
        batch: 1,
        title: "最新 Session 的计划",
      }),
    ],
  });
  persistRoadmap({ projectRoot: root, envelope: newest });
  const target = path.join(root, "IDIOTS_ROADMAP.md");
  const before = fs.readFileSync(target, "utf8");

  const stale = makeV2Envelope({
    action: "update",
    revision: 2,
    baseRevision: 1,
    steps: [
      stateStep({
        id: "step-alpha",
        label: "1",
        batch: 1,
        title: "旧 Session 试图覆盖",
      }),
    ],
  });
  assert.throws(
    () => persistRoadmap({ projectRoot: root, envelope: stale }),
    /已更新到 revision 2|拒绝覆盖/,
  );
  assert.equal(fs.readFileSync(target, "utf8"), before);
});

test("rejects any attempt to roll a completed step backwards", () => {
  const oldRoadmap = makeV2Envelope({
    capability: PYTHON_READER,
    steps: [
      stateStep({
        id: "step-alpha",
        label: "1",
        batch: 1,
        status: "completed",
        capability: PYTHON_READER,
      }),
    ],
  }).markdown;
  const incoming = makeV2Envelope({
    action: "update",
    revision: 2,
    baseRevision: 1,
    capability: NO_CODE,
    steps: [
      stateStep({
        id: "step-alpha",
        label: "1",
        batch: 1,
        status: "pending",
        capability: NO_CODE,
      }),
    ],
  }).markdown;
  assert.throws(() => mergeCompletedSteps(oldRoadmap, incoming), /不能回退/);
});

test("accepts a user-approved status advance and preserves that completed step", (t) => {
  const root = temporaryProject(t);
  const first = makeV2Envelope({
    steps: [stateStep({ id: "step-alpha", label: "1", batch: 1, title: "等待验收" })],
  });
  persistRoadmap({ projectRoot: root, envelope: first });
  const target = path.join(root, "IDIOTS_ROADMAP.md");
  const approved = fs
    .readFileSync(target, "utf8")
    .replace('"status":"pending"', '"status":"completed"')
    .replace("0/1 步已完成。", "1/1 步已完成。");
  fs.writeFileSync(target, approved, "utf8");

  const update = makeV2Envelope({
    action: "update",
    revision: 2,
    baseRevision: 1,
    steps: [
      stateStep({
        id: "step-alpha",
        label: "1",
        batch: 1,
        status: "completed",
        title: "不应覆盖已通过内容",
      }),
      stateStep({ id: "step-beta", label: "2", batch: 2, title: "下一步" }),
    ],
  });
  persistRoadmap({ projectRoot: root, envelope: update });
  const saved = fs.readFileSync(target, "utf8");
  assert.match(saved, /等待验收/);
  assert.doesNotMatch(saved, /不应覆盖已通过内容/);
  assert.equal(parseSteps(saved)[0].metadata.status, "completed");
});

test("migrates a V1 Roadmap on its first successful V2 update", (t) => {
  const root = temporaryProject(t);
  const completedV1 = makeStep({
    id: "step-01",
    label: "1",
    batch: 1,
    status: "completed",
    title: "V1 已完成内容",
    evidence: "code",
  });
  persistRoadmap({
    projectRoot: root,
    envelope: makeEnvelope({
      goal: "可靠更新计划",
      capabilityMode: PYTHON_READER.mode,
      capabilityDescription: PYTHON_READER.description,
      capabilityLanguages: PYTHON_READER.languages,
      steps: [completedV1, makeStep({ id: "step-02", label: "2", batch: 2 })],
    }),
  });

  const migration = makeV2Envelope({
    action: "update",
    revision: 1,
    baseRevision: null,
    steps: [
      stateStep({
        id: "step-01",
        label: "1",
        batch: 1,
        status: "completed",
        capability: PYTHON_READER,
        title: "不应覆盖",
        evidence: "code",
      }),
      stateStep({ id: "step-02", label: "2", batch: 2 }),
    ],
  });
  persistRoadmap({ projectRoot: root, envelope: migration });
  const saved = fs.readFileSync(path.join(root, "IDIOTS_ROADMAP.md"), "utf8");
  const state = JSON.parse(
    fs.readFileSync(path.join(root, ".idiotsroadmap", "state.json"), "utf8"),
  );
  assert.match(saved, /"version":2/);
  assert.match(saved, /V1 已完成内容/);
  assert.doesNotMatch(saved, /不应覆盖/);
  assert.equal(state.revision, 1);
  assert.deepEqual(state.usedStepIds, ["step-01", "step-02"]);
  assert.deepEqual(state.steps[0].createdUnderCapability, PYTHON_READER);
});
