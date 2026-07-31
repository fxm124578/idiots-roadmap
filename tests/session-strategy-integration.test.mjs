import assert from "node:assert/strict";
import test from "node:test";
import { validateRoadmap } from "../hooks/lib/roadmap.mjs";
import { makeEnvelope, makeStep } from "./helpers/roadmap-fixture.mjs";

const NO_CODE = { mode: "no-code", description: "完全不看代码" };

function parallelStep({
  id,
  label,
  files,
  branch,
  gitAction,
  parallelWith,
} = {}) {
  return makeStep({
    id,
    label,
    batch: 1,
    execution: "parallel",
    files,
    branch,
    gitAction,
    parallelWith,
    createdUnderCapability: NO_CODE,
  });
}

function integrationStep({ gitAction, dependsOn } = {}) {
  return makeStep({
    id: "step-integrate",
    label: "2",
    batch: 2,
    execution: "serial",
    kind: "integration",
    files: ["work/left/**", "work/right/**"],
    branch: "ir/example/integration",
    gitAction,
    dependsOn,
    createdUnderCapability: NO_CODE,
  });
}

test("V2 validates independent Worktree strategies with an immediate merge batch", () => {
  const left = parallelStep({
    id: "step-left",
    label: "1A",
    files: ["work/left/**"],
    branch: "ir/example/step-left",
    gitAction: "create-branch",
    parallelWith: ["子步骤 1B"],
  });
  const right = parallelStep({
    id: "step-right",
    label: "1B",
    files: ["work/right/**"],
    branch: "ir/example/step-right",
    gitAction: "create-branch",
    parallelWith: ["子步骤 1A"],
  });
  const envelope = makeEnvelope({
    version: 2,
    integrationBranch: "ir/example/integration",
    workspaceStrategy: "manual-worktree",
    baseCommit: "abc1234",
    steps: [
      left,
      right,
      integrationStep({
        gitAction: "merge-branches",
        dependsOn: ["step-left", "step-right"],
      }),
    ],
  });
  assert.deepEqual(validateRoadmap(envelope).errors, []);
});

test("V2 shared-directory keeps every parallel Session uncommitted until integration", () => {
  const left = parallelStep({
    id: "step-left",
    label: "1A",
    files: ["work/left/**"],
    branch: "ir/example/integration",
    gitAction: "stay",
    parallelWith: ["子步骤 1B"],
  });
  const right = parallelStep({
    id: "step-right",
    label: "1B",
    files: ["work/right/**"],
    branch: "ir/example/integration",
    gitAction: "stay",
    parallelWith: ["子步骤 1A"],
  });
  const envelope = makeEnvelope({
    version: 2,
    integrationBranch: "ir/example/integration",
    workspaceStrategy: "shared-directory",
    baseCommit: "abc1234",
    steps: [
      left,
      right,
      integrationStep({
        gitAction: "stay",
        dependsOn: ["step-left", "step-right"],
      }),
    ],
  });
  assert.deepEqual(validateRoadmap(envelope).errors, []);
});

test("V2 rejects parallel work without a verified base or with shared-directory branches", () => {
  const left = parallelStep({
    id: "step-left",
    label: "1A",
    files: ["work/left/**"],
    branch: "ir/example/step-left",
    gitAction: "create-branch",
    parallelWith: ["子步骤 1B"],
  });
  const right = parallelStep({
    id: "step-right",
    label: "1B",
    files: ["work/right/**"],
    branch: "ir/example/step-right",
    gitAction: "create-branch",
    parallelWith: ["子步骤 1A"],
  });
  const envelope = makeEnvelope({
    version: 2,
    integrationBranch: "ir/example/integration",
    workspaceStrategy: "shared-directory",
    steps: [
      left,
      right,
      integrationStep({
        gitAction: "stay",
        dependsOn: ["step-left", "step-right"],
      }),
    ],
  });
  const errors = validateRoadmap(envelope).errors.join("\n");
  assert.match(errors, /baseCommit/);
  assert.match(errors, /gitAction 必须为 stay/);
});
