import { APPLY_COMMAND, HANDOFF_GUARD } from "../../hooks/lib/project-state.mjs";

export function makeProjectState(overrides = {}) {
  const state = {
    schemaVersion: 3,
    roadmapId: "rm_fixture001",
    revision: 1,
    baseRevision: null,
    goal: {
      summary: "完成个人清单流程",
      success: "用户可以查看并完成清单项目",
      nonGoals: ["多人协作"],
    },
    capability: { mode: "no-code", description: "完全不看代码" },
    project: {
      origin: "existing",
      managementMode: "managed",
      hasFrontend: true,
      analysis: {
        summary: "已有页面和本地数据，尚未确认保存行为。",
        fingerprint: "a".repeat(64),
        stateRevision: 1,
        baseCommit: "0123456",
        evidence: [
          { confidence: "observed", summary: "检测到清单页面。", path: "src/list/page.tsx" },
        ],
        unresolved: ["刷新后的保存行为尚未验证"],
      },
    },
    repository: {
      isGitRepo: true,
      workingTree: "clean",
      currentBranch: "main",
      remoteProvider: "none",
      remoteName: null,
      githubMode: "local-only",
      integrationBranch: "ir/list/integration",
      workspaceStrategy: "shared-directory",
      baseCommit: "0123456",
      pushPolicy: "manual-after-final-acceptance",
    },
    milestones: [
      { id: "ms_basic", title: "清单基本流程", outcome: "可以查看并完成项目", status: "active" },
    ],
    modules: [
      {
        id: "mod_page",
        name: "清单页面",
        responsibility: "展示和操作清单",
        nonResponsibilities: ["账号权限"],
        files: ["src/list/**"],
        userOutcome: "可以查看并完成项目",
        evidence: [
          { confidence: "observed", summary: "页面入口存在。", path: "src/list/page.tsx" },
        ],
      },
    ],
    contracts: [],
    workItems: [
      {
        id: "work_page",
        title: "打开清单页面",
        outcome: "看到并操作清单项目",
        kind: "frontend",
        dataMode: "real",
        status: "planned",
        milestoneId: "ms_basic",
        moduleIds: ["mod_page"],
        contractIds: [],
        batch: 1,
        execution: "serial",
        dependsOn: [],
        files: ["src/list/**"],
        session: {
          strategy: "shared-directory",
          baseCommit: "0123456",
          prompt: "",
        },
        completion: {
          authority: "user-experience",
          acceptance: ["打开清单页，能看到并完成一个清单项目。"],
          review: { status: "pending", summary: "" },
        },
      },
    ],
    changes: [],
    decisions: [],
    current: {
      batch: 1,
      workItemIds: ["work_page"],
      approval: {
        proposalId: "proposal_fixture001",
        status: "proposed",
        batch: 1,
        workItemIds: ["work_page"],
        summary: "让清单页面真正可以使用",
        visibleResults: ["可以查看并完成一个清单项目"],
        nonGoals: ["多人协作"],
        reason: "这是最早可以直接体验的完整结果。",
        proposedAtRevision: 1,
        approvedAtRevision: null,
      },
    },
  };
  return { ...state, ...overrides };
}

export function makeV3Envelope(state = makeProjectState(), action = "new") {
  const metadata = {
    version: 3,
    action,
    roadmapId: state.roadmapId,
    revision: state.revision,
    baseRevision: state.baseRevision,
  };
  const markdown = `<!-- IR_STATE:BEGIN\n${JSON.stringify(state, null, 2)}\nIR_STATE:END -->\n`;
  return {
    metadata,
    markdown,
    projectState: state,
    text: `<!-- IDIOTS_ROADMAP:BEGIN ${JSON.stringify(metadata)} -->\n${markdown}<!-- IDIOTS_ROADMAP:END -->`,
  };
}
