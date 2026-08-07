import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIDENCE = new Set(["verified", "observed", "declared", "conflict", "unknown"]);
const ORIGIN = new Set(["new", "existing"]);
const MANAGEMENT_MODE = new Set(["simple", "managed"]);
const MILESTONE_STATUS = new Set(["planned", "active", "completed", "superseded"]);
const WORK_STATUS = new Set([
  "planned",
  "ready",
  "in_progress",
  "technical_verified",
  "awaiting_user",
  "accepted",
  "blocked",
  "superseded",
]);
const CHANGE_KIND = new Set([
  "current-adjustment",
  "backlog",
  "module-change",
  "contract-change",
  "goal-change",
]);
const CHANGE_STATUS = new Set(["proposed", "active", "resolved", "deferred"]);
const AUTHORITY = new Set(["ai-review", "user-experience"]);
const EXECUTION = new Set(["serial", "parallel"]);
const WORK_KIND = new Set(["frontend", "backend", "integration", "cli", "migration", "infrastructure", "review", "other"]);
const DATA_MODE = new Set(["none", "mock", "real"]);
const CONTRACT_KIND = new Set(["api", "data", "event", "storage", "config", "ui", "other"]);
const STRATEGY = new Set([
  "codex-managed-worktree",
  "claude-managed-worktree",
  "manual-worktree",
  "shared-directory",
]);
const SESSION_STRATEGY = new Set([...STRATEGY, "serial"]);
const REVIEW_STATUS = new Set(["pending", "passed", "disputed", "needs-review-session"]);
const APPROVAL_STATUS = new Set(["proposed", "approved"]);
const GITHUB_MODE = new Set(["connected", "create-private", "connect-existing", "local-only"]);
const WORK_TRANSITIONS = new Map([
  ["planned", new Set(["planned", "ready", "blocked", "superseded"])],
  ["ready", new Set(["ready", "in_progress", "blocked", "superseded"])],
  ["in_progress", new Set(["in_progress", "technical_verified", "awaiting_user", "blocked", "superseded"])],
  ["awaiting_user", new Set(["awaiting_user", "accepted", "in_progress", "blocked"])],
  ["blocked", new Set(["blocked", "ready", "in_progress", "superseded"])],
  ["technical_verified", new Set(["technical_verified"])],
  ["accepted", new Set(["accepted"])],
  ["superseded", new Set(["superseded"])],
]);
const HANDOFF_GUARD =
  "<!-- IR_SESSION_HANDOFF_GUARD:current-work-only,read-state,run-checks,stop-after-handoff,no-auto-next -->";
const APPLY_COMMAND =
  "node .idiotsroadmap/runtime/roadmap-state.mjs apply .idiotsroadmap/next-state.json";
const TECHNICAL_ACCEPTANCE =
  /(代码|diff|终端|日志|测试报告|提交记录|\bcode\b|\bterminal\b|\blog(?:s)?\b|test report|commit history)/iu;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validId(value, prefix) {
  return (
    typeof value === "string" &&
    new RegExp(`^${prefix}_[A-Za-z0-9][A-Za-z0-9_-]{2,79}$`, "u").test(value)
  );
}

function validText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validBranch(value) {
  return (
    validText(value) &&
    !/^[.-]|[/.]$|\.lock$|\.\.|\/\/|@\{|[\\\s~^:?*[\]]/u.test(value)
  );
}

function validRelativePath(value) {
  if (!validText(value)) return false;
  const normalized = value.trim();
  if (
    normalized.includes("\\") ||
    normalized.includes("\0") ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/u.test(normalized) ||
    normalized.split("/").includes("..") ||
    /[?[\]]/u.test(normalized)
  ) return false;
  const wildcard = normalized.indexOf("*");
  return wildcard < 0 || normalized.endsWith("/*") || normalized.endsWith("/**");
}

function scopeRoot(value) {
  return value.trim().replace(/\/\*{1,2}$/u, "").replace(/\/+$/u, "") || ".";
}

function scopesOverlap(left, right) {
  const a = scopeRoot(left);
  const b = scopeRoot(right);
  return a === "." || b === "." || a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function validateEvidence(evidence, label, errors) {
  if (!Array.isArray(evidence)) {
    errors.push(`${label}.evidence 必须是数组。`);
    return;
  }
  for (const [index, item] of evidence.entries()) {
    if (!isObject(item)) {
      errors.push(`${label}.evidence[${index}] 必须是对象。`);
      continue;
    }
    if (!CONFIDENCE.has(item.confidence)) {
      errors.push(`${label}.evidence[${index}].confidence 无效。`);
    }
    if (!validText(item.summary)) errors.push(`${label}.evidence[${index}].summary 不能为空。`);
    if (item.path !== undefined && !validRelativePath(item.path)) {
      errors.push(`${label}.evidence[${index}].path 必须是安全的项目相对路径。`);
    }
  }
}

function uniqueIds(items, prefix, label, errors) {
  const ids = new Set();
  if (!Array.isArray(items)) {
    errors.push(`${label} 必须是数组。`);
    return ids;
  }
  for (const [index, item] of items.entries()) {
    if (!isObject(item) || !validId(item.id, prefix)) {
      errors.push(`${label}[${index}].id 必须是稳定的 ${prefix}_ 标识。`);
      continue;
    }
    if (ids.has(item.id)) errors.push(`${label} ID 重复：${item.id}。`);
    ids.add(item.id);
  }
  return ids;
}

function validateReferences(values, allowed, label, errors) {
  if (!Array.isArray(values)) {
    errors.push(`${label} 必须是数组。`);
    return;
  }
  for (const value of values) {
    if (!allowed.has(value)) errors.push(`${label} 引用了不存在的 ${value}。`);
  }
}

function validateApprovalGate(state, current, workIds, errors) {
  const approval = current.approval;
  if (current.workItemIds.length === 0) {
    if (approval !== undefined && approval !== null) errors.push("项目完成时 current.approval 必须为空。");
    return;
  }
  // Older V3 files did not contain an approval gate. Treat them as unapproved at
  // runtime so an upgrade never starts work without asking the user.
  if (approval === undefined || approval === null) return;
  if (!isObject(approval)) {
    errors.push("state.current.approval 必须是对象。 ");
    return;
  }
  if (!validId(approval.proposalId, "proposal")) errors.push("current.approval.proposalId 无效。 ");
  if (!APPROVAL_STATUS.has(approval.status)) errors.push("current.approval.status 无效。 ");
  if (!Number.isInteger(approval.proposedAtRevision) || approval.proposedAtRevision < 1 || approval.proposedAtRevision > state.revision) {
    errors.push("current.approval.proposedAtRevision 无效。 ");
  }
  if (approval.status === "approved") {
    if (!Number.isInteger(approval.approvedAtRevision) || approval.approvedAtRevision < approval.proposedAtRevision || approval.approvedAtRevision > state.revision) {
      errors.push("已批准批次必须记录有效的 approvedAtRevision。 ");
    }
  } else if (approval.approvedAtRevision !== null && approval.approvedAtRevision !== undefined) {
    errors.push("尚未批准的批次不得记录 approvedAtRevision。 ");
  }
  if (!Number.isInteger(approval.batch) || approval.batch !== current.batch) errors.push("批准批次必须与 current.batch 一致。 ");
  if (!Array.isArray(approval.workItemIds) || approval.workItemIds.length === 0 || approval.workItemIds.length > 3) {
    errors.push("current.approval.workItemIds 必须包含本批 1–3 个工作项。 ");
  } else {
    validateReferences(approval.workItemIds, workIds, "current.approval.workItemIds", errors);
    for (const id of current.workItemIds) {
      if (!approval.workItemIds.includes(id)) errors.push(`当前工作 ${id} 不在本批批准范围内。`);
    }
  }
  if (!validText(approval.summary)) errors.push("current.approval.summary 不能为空。 ");
  if (!Array.isArray(approval.visibleResults) || approval.visibleResults.length < 1 || approval.visibleResults.length > 2 || approval.visibleResults.some((item) => !validText(item))) {
    errors.push("current.approval.visibleResults 必须包含 1–2 个用户可理解结果。 ");
  }
  if (!Array.isArray(approval.nonGoals) || approval.nonGoals.some((item) => !validText(item))) {
    errors.push("current.approval.nonGoals 必须是文字数组。 ");
  }
  if (!validText(approval.reason)) errors.push("current.approval.reason 不能为空。 ");
}

export function validateProjectState(state, metadata = null) {
  const errors = [];
  if (!isObject(state)) return { valid: false, errors: ["IR_STATE 必须是 JSON 对象。"] };
  if (state.schemaVersion !== 3) errors.push("state.schemaVersion 必须为 3。");
  if (!validId(state.roadmapId, "rm")) errors.push("state.roadmapId 必须是稳定的 rm_ 标识。");
  if (!Number.isInteger(state.revision) || state.revision < 1) errors.push("state.revision 必须是正整数。");
  if (state.baseRevision !== null && (!Number.isInteger(state.baseRevision) || state.baseRevision < 1)) {
    errors.push("state.baseRevision 必须为 null 或正整数。");
  }
  if (metadata) {
    for (const key of ["roadmapId", "revision", "baseRevision"]) {
      if (state[key] !== metadata[key]) errors.push(`state.${key} 必须与 BEGIN metadata 一致。`);
    }
  }

  if (!isObject(state.goal) || !validText(state.goal.summary) || !validText(state.goal.success)) {
    errors.push("state.goal 必须包含 summary 和 success。 ");
  }
  if (!Array.isArray(state.goal?.nonGoals)) errors.push("state.goal.nonGoals 必须是数组。");
  if (!isObject(state.capability) || !["no-code", "code-reader", "custom"].includes(state.capability.mode)) {
    errors.push("state.capability.mode 无效。");
  }
  if (!validText(state.capability?.description)) errors.push("state.capability.description 不能为空。");
  if (state.capability?.mode === "code-reader" && (!Array.isArray(state.capability.languages) || state.capability.languages.length === 0)) {
    errors.push("code-reader 能力必须明确允许阅读的语言。");
  }

  if (!isObject(state.project) || !ORIGIN.has(state.project.origin)) errors.push("state.project.origin 无效。");
  if (!MANAGEMENT_MODE.has(state.project?.managementMode)) errors.push("state.project.managementMode 无效。");
  if (typeof state.project?.hasFrontend !== "boolean") errors.push("state.project.hasFrontend 必须是布尔值。");
  if (!isObject(state.project?.analysis) || !validText(state.project.analysis.summary)) {
    errors.push("state.project.analysis.summary 不能为空。");
  } else {
    validateEvidence(state.project.analysis.evidence || [], "state.project.analysis", errors);
    if (!Array.isArray(state.project.analysis.unresolved)) {
      errors.push("state.project.analysis.unresolved 必须是数组。");
    }
    if (!/^[0-9a-f]{64}$/iu.test(state.project.analysis.fingerprint || "")) {
      errors.push("state.project.analysis.fingerprint 必须是仓库只读扫描指纹。");
    }
    if (!Number.isInteger(state.project.analysis.stateRevision) || state.project.analysis.stateRevision < 1 || state.project.analysis.stateRevision > state.revision) {
      errors.push("state.project.analysis.stateRevision 必须记录最近一次分析对应的 Roadmap revision。");
    }
    if (state.project.analysis.baseCommit !== null && state.project.analysis.baseCommit !== undefined && !/^[0-9a-f]{7,64}$/iu.test(state.project.analysis.baseCommit)) {
      errors.push("state.project.analysis.baseCommit 必须为 null 或 Git commit。");
    }
  }

  if (!isObject(state.repository)) errors.push("state.repository 必须是对象。");
  if (state.repository && typeof state.repository.isGitRepo !== "boolean") {
    errors.push("state.repository.isGitRepo 必须是布尔值。");
  }
  if (state.repository?.workspaceStrategy !== null && state.repository?.workspaceStrategy !== undefined && !STRATEGY.has(state.repository.workspaceStrategy)) {
    errors.push("state.repository.workspaceStrategy 无效。");
  }
  if (!new Set(["clean", "dirty", "unknown"]).has(state.repository?.workingTree)) {
    errors.push("state.repository.workingTree 无效。");
  }
  if (!new Set(["github", "other", "none"]).has(state.repository?.remoteProvider)) {
    errors.push("state.repository.remoteProvider 无效。");
  }
  if (state.repository?.githubMode !== undefined && !GITHUB_MODE.has(state.repository.githubMode)) {
    errors.push("state.repository.githubMode 无效。");
  }
  if (metadata?.action === "new" && !GITHUB_MODE.has(state.repository?.githubMode)) {
    errors.push("新 Roadmap 必须记录 repository.githubMode。 ");
  }
  if (state.repository?.githubMode === "connected" && state.repository?.remoteProvider === "none") {
    errors.push("repository.githubMode 为 connected 时必须存在远程仓库。 ");
  }
  if (state.repository?.remoteProvider !== "none" && state.repository?.githubMode !== undefined && state.repository.githubMode !== "connected") {
    errors.push("检测到远程仓库时 repository.githubMode 必须为 connected。 ");
  }
  if (state.repository?.pushPolicy !== "manual-after-final-acceptance") {
    errors.push("state.repository.pushPolicy 无效。");
  }
  if (state.repository?.baseCommit !== null && state.repository?.baseCommit !== undefined && !/^[0-9a-f]{7,64}$/iu.test(state.repository.baseCommit)) {
    errors.push("state.repository.baseCommit 必须为 null 或 Git commit。");
  }
  if (!validText(state.repository?.integrationBranch)) errors.push("state.repository.integrationBranch 不能为空。");

  const milestoneIds = uniqueIds(state.milestones, "ms", "state.milestones", errors);
  if (milestoneIds.size === 0) errors.push("state.milestones 至少需要一个里程碑。");
  for (const milestone of state.milestones || []) {
    if (!validText(milestone.title) || !validText(milestone.outcome)) {
      errors.push(`${milestone.id || "milestone"} 必须包含 title 和 outcome。`);
    }
    if (!MILESTONE_STATUS.has(milestone.status)) errors.push(`${milestone.id} 的 status 无效。`);
  }

  const moduleIds = uniqueIds(state.modules, "mod", "state.modules", errors);
  if (moduleIds.size === 0) errors.push("state.modules 至少需要一个模块。");
  for (const module of state.modules || []) {
    if (!validText(module.name) || !validText(module.responsibility)) {
      errors.push(`${module.id || "module"} 必须包含 name 和 responsibility。`);
    }
    if (!Array.isArray(module.nonResponsibilities)) errors.push(`${module.id}.nonResponsibilities 必须是数组。`);
    if (!Array.isArray(module.files) || module.files.length === 0 || module.files.some((file) => !validRelativePath(file))) {
      errors.push(`${module.id}.files 必须是安全的项目相对路径数组。`);
    }
    if (!validText(module.userOutcome)) errors.push(`${module.id}.userOutcome 不能为空。`);
    validateEvidence(module.evidence || [], `module ${module.id}`, errors);
  }

  const contractIds = uniqueIds(state.contracts, "ctr", "state.contracts", errors);
  for (const contract of state.contracts || []) {
    if (!validText(contract.name) || !validText(contract.version) || !validText(contract.summary)) {
      errors.push(`${contract.id || "contract"} 必须包含 name、version 和 summary。`);
    }
    if (!CONTRACT_KIND.has(contract.kind)) errors.push(`${contract.id}.kind 无效。`);
    if (!moduleIds.has(contract.provider)) errors.push(`${contract.id}.provider 不存在。`);
    validateReferences(contract.consumers, moduleIds, `${contract.id}.consumers`, errors);
    if (!validText(contract.compatibility)) errors.push(`${contract.id}.compatibility 不能为空。`);
    validateEvidence(contract.evidence || [], `contract ${contract.id}`, errors);
  }

  const workIds = uniqueIds(state.workItems, "work", "state.workItems", errors);
  if (workIds.size === 0) errors.push("state.workItems 至少需要一个工作项。");
  const batches = new Map();
  const isolatedBranches = new Set();
  for (const work of state.workItems || []) {
    if (!validText(work.title) || !validText(work.outcome)) errors.push(`${work.id} 必须包含 title 和 outcome。`);
    if (work.legacyStepId !== undefined && !validText(work.legacyStepId)) errors.push(`${work.id}.legacyStepId 无效。`);
    if (!WORK_STATUS.has(work.status)) errors.push(`${work.id}.status 无效。`);
    if (work.status === "blocked" && !validText(work.blocker)) errors.push(`${work.id}.blocker 不能为空。`);
    if (!WORK_KIND.has(work.kind)) errors.push(`${work.id}.kind 无效。`);
    if (!DATA_MODE.has(work.dataMode)) errors.push(`${work.id}.dataMode 无效。`);
    if (!milestoneIds.has(work.milestoneId)) errors.push(`${work.id}.milestoneId 不存在。`);
    validateReferences(work.moduleIds, moduleIds, `${work.id}.moduleIds`, errors);
    validateReferences(work.contractIds || [], contractIds, `${work.id}.contractIds`, errors);
    validateReferences(work.dependsOn || [], workIds, `${work.id}.dependsOn`, errors);
    if (!Number.isInteger(work.batch) || work.batch < 1) errors.push(`${work.id}.batch 必须是正整数。`);
    if (!EXECUTION.has(work.execution)) errors.push(`${work.id}.execution 无效。`);
    if (!Array.isArray(work.files) || work.files.length === 0 || work.files.some((file) => !validRelativePath(file))) {
      errors.push(`${work.id}.files 必须是非空的安全相对路径数组。`);
    }
    if (!isObject(work.completion) || !AUTHORITY.has(work.completion.authority)) {
      errors.push(`${work.id}.completion.authority 无效。`);
    } else {
      const acceptance = work.completion.acceptance;
      if (!Array.isArray(acceptance)) errors.push(`${work.id}.completion.acceptance 必须是数组。`);
      else if (work.completion.authority === "user-experience") {
        if (acceptance.length < 1 || acceptance.length > 2) errors.push(`${work.id} 的用户体验验收必须为 1–2 项。`);
        if (state.capability?.mode === "no-code" && acceptance.some((item) => TECHNICAL_ACCEPTANCE.test(String(item)))) {
          errors.push(`${work.id} 的无代码验收包含技术判断。`);
        }
      } else if (acceptance.length !== 0) {
        errors.push(`${work.id} 是 AI 技术复核，不得把验收项交给用户。`);
      }
      if (!isObject(work.completion.review) || !REVIEW_STATUS.has(work.completion.review.status)) {
        errors.push(`${work.id}.completion.review.status 无效。`);
      }
      if (work.completion.review?.status !== "pending" && !validText(work.completion.review?.summary)) {
        errors.push(`${work.id} 的复核状态不是 pending 时必须提供简短结论。`);
      }
      if (work.status === "technical_verified" && (work.completion.authority !== "ai-review" || work.completion.review.status !== "passed")) {
        errors.push(`${work.id} 只有 AI 复核通过后才能标为 technical_verified。`);
      }
      if (work.completion.authority === "ai-review" && work.completion.review.status === "passed" && work.status !== "technical_verified") {
        errors.push(`${work.id} 的 AI 复核通过状态必须与 technical_verified 一致。`);
      }
      if (work.status === "accepted" && work.completion.authority !== "user-experience") {
        errors.push(`${work.id} 的 accepted 只用于用户体验验收。`);
      }
      if (work.status === "accepted" && work.completion.review.status !== "passed") {
        errors.push(`${work.id} 只有技术复核和用户体验都通过后才能标为 accepted。`);
      }
    }
    if (work.session !== undefined && work.session !== null) {
      if (!isObject(work.session) || !SESSION_STRATEGY.has(work.session.strategy)) {
        errors.push(`${work.id}.session.strategy 无效。`);
      }
      if (work.session?.baseCommit !== null && work.session?.baseCommit !== undefined && !/^[0-9a-f]{7,64}$/iu.test(work.session.baseCommit)) {
        errors.push(`${work.id}.session.baseCommit 必须为 null 或 Git commit。`);
      }
      if (metadata?.action === "new" && work.session.branch === undefined) {
        errors.push(`${work.id}.session.branch 必须在新 Roadmap 中明确规划。`);
      }
      if (work.session.branch !== undefined) {
        if (work.execution === "parallel" && work.session.strategy === "shared-directory") {
          if (work.session.branch !== null) errors.push(`${work.id} 使用共享目录并行时不得规划分支。`);
        } else if (!validBranch(work.session.branch)) {
          errors.push(`${work.id}.session.branch 不是安全的 Git 分支名。`);
        } else if (work.execution === "parallel") {
          if (work.session.branch === state.repository?.integrationBranch) errors.push(`${work.id} 的并行分支不能占用整合分支。`);
          if (isolatedBranches.has(work.session.branch)) errors.push(`并行任务分支重复：${work.session.branch}。`);
          isolatedBranches.add(work.session.branch);
        } else if (work.session.branch !== state.repository?.integrationBranch) {
          errors.push(`${work.id} 的串行或整合工作必须使用 repository.integrationBranch。`);
        }
      }
    }
    if (work.claim !== undefined && work.claim !== null) {
      if (!isObject(work.claim) || !validId(work.claim.id, "claim")) {
        errors.push(`${work.id}.claim.id 无效。`);
      }
      if (!Number.isInteger(work.claim?.startedAtRevision) || work.claim.startedAtRevision < 1 || work.claim.startedAtRevision > state.revision) {
        errors.push(`${work.id}.claim.startedAtRevision 无效。`);
      }
      if (!new Set(["in_progress", "awaiting_user", "blocked"]).has(work.status)) {
        errors.push(`${work.id} 只有开发中、等待体验或阻塞时才能保留 Session 领取记录。`);
      }
    }
    if (work.execution === "parallel") {
      if (!STRATEGY.has(state.repository?.workspaceStrategy)) {
        errors.push(`${work.id} 并行前必须确定 repository.workspaceStrategy。`);
      }
      if (work.session?.strategy !== state.repository?.workspaceStrategy) {
        errors.push(`${work.id}.session.strategy 必须与仓库并行策略一致。`);
      }
      if (!/^[0-9a-f]{7,64}$/iu.test(state.repository?.baseCommit || "") || work.session?.baseCommit !== state.repository?.baseCommit) {
        errors.push(`${work.id} 必须使用共同 baseCommit。`);
      }
      if (state.repository?.workspaceStrategy === "shared-directory" && validText(work.session?.prompt) && !work.session.prompt.includes("不切分支、不暂存、不提交")) {
        errors.push(`${work.id} 的共享目录提示词必须明确不切分支、不暂存、不提交。`);
      }
    }
    if (Number.isInteger(work.batch)) {
      if (!batches.has(work.batch)) batches.set(work.batch, []);
      batches.get(work.batch).push(work);
    }
  }

  const workById = new Map((state.workItems || []).map((item) => [item.id, item]));
  for (const work of state.workItems || []) {
    for (const dependencyId of work.dependsOn || []) {
      const dependency = workById.get(dependencyId);
      if (dependency && (!Number.isInteger(dependency.batch) || dependency.batch >= work.batch)) {
        errors.push(`${work.id} 的前置工作 ${dependencyId} 必须位于更早批次。`);
      }
    }
  }

  for (const work of state.workItems || []) {
    if (work.dataMode !== "mock" || work.status === "superseded") continue;
    const hasRealFollowup = (state.workItems || []).some(
      (candidate) =>
        candidate.batch > work.batch &&
        candidate.dataMode === "real" &&
        candidate.completion?.authority === "user-experience" &&
        candidate.moduleIds?.some((moduleId) => work.moduleIds?.includes(moduleId)),
    );
    if (!hasRealFollowup) errors.push(`${work.id} 使用演示数据后必须安排同一模块的真实集成体验。`);
  }

  if (!isObject(state.current) || (state.current.batch !== null && (!Number.isInteger(state.current.batch) || state.current.batch < 1)) || !Array.isArray(state.current.workItemIds)) {
    errors.push("state.current 必须包含 batch 和 workItemIds。 ");
  } else {
    if (state.current.workItemIds.length > 3) {
      errors.push("当前批次最多包含 3 个工作项。 ");
    }
    if (state.current.workItemIds.length === 0) {
      if (state.current.batch !== null) errors.push("项目完成时 current.batch 必须为 null。");
      if ((state.workItems || []).some((item) => !["accepted", "technical_verified", "superseded"].includes(item.status))) {
        errors.push("仍有未完成工作时 current.workItemIds 不能为空。");
      }
    } else if (state.current.batch === null) {
      errors.push("存在当前工作时 current.batch 不能为 null。");
    }
    validateReferences(state.current.workItemIds, workIds, "state.current.workItemIds", errors);
    validateApprovalGate(state, state.current, workIds, errors);
    if (metadata?.action === "new" && state.current.approval?.status === "approved") {
      errors.push("新 Roadmap 的第一批必须等待用户批准，不能直接标为 approved。 ");
    }
    const current = new Set(state.current.workItemIds);
    const approval = state.current.approval;
    for (const work of state.workItems || []) {
      const prompt = work.session?.prompt;
      if (current.has(work.id)) {
        if (work.batch !== state.current.batch) errors.push(`${work.id} 不属于当前批次。`);
        if (["accepted", "technical_verified", "superseded"].includes(work.status)) errors.push(`${work.id} 已结束，不能仍在当前批次。`);
        if (["awaiting_user", "blocked"].includes(work.status)) {
          if (validText(prompt)) errors.push(`${work.id} 已等待体验或被阻塞，不得继续显示开发提示词。`);
          if (work.status === "awaiting_user" && work.completion?.authority !== "user-experience") {
            errors.push(`${work.id} 只有用户体验工作可以等待用户验收。`);
          }
        } else if (validText(prompt) && (!prompt.includes(HANDOFF_GUARD) || !prompt.includes(APPLY_COMMAND))) {
          errors.push(`${work.id} 的旧版 Session 提示词缺少接力保护标记。`);
        }
      } else if (validText(prompt)) {
        errors.push(`${work.id} 不在当前批次，不得预写完整 Session 提示词。`);
      }
    }
    const currentWork = (state.workItems || []).filter((item) => current.has(item.id));
    if (approval?.status === "proposed" && currentWork.some((item) => !["planned", "blocked"].includes(item.status))) {
      errors.push("下一批尚未批准时，工作项不得进入 ready 或开发状态。 ");
    }
    if (approval?.status === "approved" && currentWork.some((item) => item.status === "planned")) {
      errors.push("下一批批准后，当前工作项不能继续停留在 planned。 ");
    }
    if (currentWork.length > 1 && currentWork.some((item) => item.execution !== "parallel")) {
      errors.push("当前批次包含多个工作项时必须全部为 parallel。");
    }
    const hasAnyCompleted = (state.workItems || []).some((item) => ["accepted", "technical_verified"].includes(item.status));
    if (
      !hasAnyCompleted &&
      state.capability?.mode === "no-code" &&
      state.project?.hasFrontend === true &&
      !currentWork.some(
        (item) => ["frontend", "integration"].includes(item.kind) && item.completion?.authority === "user-experience",
      )
    ) {
      errors.push("完全不看代码且项目有前端时，首批必须包含可直接体验的前端结果。");
    }
  }

  for (const [batch, members] of batches) {
    const parallel = members.filter((item) => item.execution === "parallel");
    if (parallel.length > 0 && parallel.length !== members.length) errors.push(`第 ${batch} 批不能混用串行和并行。`);
    if (parallel.length > 3) errors.push(`第 ${batch} 批并行 Session 超过 3 个。`);
    for (let left = 0; left < parallel.length; left += 1) {
      for (let right = left + 1; right < parallel.length; right += 1) {
        if (parallel[left].files.some((a) => parallel[right].files.some((b) => scopesOverlap(a, b)))) {
          errors.push(`第 ${batch} 批 ${parallel[left].id} 与 ${parallel[right].id} 文件范围重叠。`);
        }
      }
    }
    if (parallel.length > 1) {
      const integration = (state.workItems || []).filter(
        (item) => item.batch === batch + 1 && item.execution === "serial" && item.kind === "integration",
      );
      if (integration.length !== 1 || !parallel.every((item) => integration[0]?.dependsOn?.includes(item.id))) {
        errors.push(`第 ${batch} 批后必须紧接一个依赖全部并行项的唯一整合工作项。`);
      }
    }
  }

  const changeIds = uniqueIds(state.changes || [], "chg", "state.changes", errors);
  void changeIds;
  for (const change of state.changes || []) {
    if (!CHANGE_KIND.has(change.kind) || !CHANGE_STATUS.has(change.status)) errors.push(`${change.id} 的类型或状态无效。`);
    if (!validText(change.summary)) errors.push(`${change.id}.summary 不能为空。`);
    validateReferences(change.affectedModules || [], moduleIds, `${change.id}.affectedModules`, errors);
    validateReferences(change.affectedContracts || [], contractIds, `${change.id}.affectedContracts`, errors);
    if (!Array.isArray(change.unaffected)) errors.push(`${change.id}.unaffected 必须是数组。`);
  }

  if (!Array.isArray(state.decisions)) errors.push("state.decisions 必须是数组。 ");
  else {
    const ids = new Set();
    for (const [index, decision] of state.decisions.entries()) {
      if (!isObject(decision) || !validId(decision.id, "decision")) errors.push(`state.decisions[${index}].id 无效。`);
      else if (ids.has(decision.id)) errors.push(`用户决定 ID 重复：${decision.id}。`);
      else ids.add(decision.id);
      if (!new Set(["user", "ai"]).has(decision?.source) || !validText(decision?.summary)) {
        errors.push(`state.decisions[${index}] 必须包含 source 和 summary。`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

function escapeFence(value) {
  return String(value).replace(/```/gu, "` ` `");
}

function progress(state) {
  const relevant = state.workItems.filter((item) => item.status !== "superseded");
  const done = relevant.filter((item) => ["accepted", "technical_verified"].includes(item.status));
  return `${done.length}/${relevant.length}`;
}

function repositorySummary(repository) {
  const lines = [
    repository.isGitRepo
      ? "- 本地版本保护：已启用，AI 可以保留和恢复开发记录。"
      : "- 本地版本保护：尚未启用；第一轮开始前由 AI 建立，不需要你执行命令，也不会上传网络。",
  ];
  if (repository.remoteProvider === "github") {
    lines.push(`- GitHub 备份：已连接${repository.remoteName ? `（${repository.remoteName}）` : ""}；仍按用户授权决定何时推送。`);
  } else if (repository.remoteProvider === "other") {
    lines.push(`- 云端备份：已连接${repository.remoteName ? `（${repository.remoteName}）` : ""}。`);
  } else if (repository.githubMode === "create-private") {
    lines.push("- GitHub 备份：已选择创建私人仓库；AI 会在开发前检查登录状态并引导连接，不会创建公开仓库。 ");
  } else if (repository.githubMode === "connect-existing") {
    lines.push("- GitHub 备份：已选择连接已有仓库；AI 会在开发前索取并检查仓库地址。 ");
  } else if (repository.githubMode === "local-only") {
    lines.push("- GitHub 备份：暂时不启用，项目只保存在这台电脑。 ");
  } else {
    lines.push("- GitHub 备份：尚未选择；下次规划时只需选择是否需要云端备份。 ");
  }
  return lines;
}

function currentAction(work, approval) {
  if (work.completion.authority === "user-experience" && work.status === "awaiting_user") {
    return "不用打开新 Session。现在只体验下面最多两项结果；满意后回到刚才的开发 Session 完成收尾。";
  }
  if (work.status === "blocked") return `当前工作被阻塞：${work.blocker} 暂时不要打开后续开发 Session。`;
  if (approval?.status !== "approved") return "下一批还没有开始。先看下面的结果卡；符合你的需求就回复“开始下一轮”，不符合就直接说要改哪里。";
  if (work.status === "in_progress") return "本批已有 Session 正在开发。不要重复开启同一任务；需要继续其他并行任务时，在新 Session 运行 $idiots-roadmap-start。";
  return "下一批已经批准。新建开发 Session 并运行 $idiots-roadmap-start；它会自动读取状态和领取任务，不用复制长提示词。";
}

function renderWorkItem(work) {
  const mode =
    work.status === "awaiting_user"
      ? "👀 等待用户体验"
      : work.status === "blocked"
        ? "⛔ 当前阻塞"
        : work.execution === "parallel"
          ? "🔀 可并行 Session"
          : "➡️ 串行 Session";
  const lines = [
    `### 🧩 ${work.title}`,
    "",
    `${mode}｜第 ${work.batch} 批｜文件范围：${work.files.join("、")}`,
    "",
    `结果：${work.outcome}`,
    "",
  ];
  if (work.status === "blocked") lines.push("", `需要先解决：${work.blocker}`);
  if (work.completion.authority === "user-experience") {
    lines.push("", "✅ 需要你亲自体验：", "");
    for (const item of work.completion.acceptance) lines.push(`- [ ] ${item}`);
  } else {
    const review = work.completion.review;
    const summary =
      review.status === "passed"
        ? "开发与独立复核一致，没有需要你判断的技术问题。"
        : review.status === "disputed"
          ? "开发与复核存在分歧，AI 必须先解决，暂时不要开启后续开发。"
          : review.status === "needs-review-session"
            ? "当前宿主不能独立复核；本 Session 完成后会生成一个复核 Session 接力。"
            : "完成后交给独立复核 Agent；你不需要阅读代码或测试报告。";
    lines.push("", `🤖 技术复核：${summary}`);
  }
  return lines.join("\n");
}

export function renderRoadmap(state) {
  const currentIds = new Set(state.current.workItemIds);
  const current = state.workItems.filter((item) => currentIds.has(item.id));
  const activeChanges = state.changes.filter((change) => ["proposed", "active"].includes(change.status));
  const completed = state.workItems.filter((item) => ["accepted", "technical_verified"].includes(item.status)).slice(-5);
  const moduleLimit = state.project.managementMode === "simple" ? 3 : 8;
  const modules = state.modules.slice(0, moduleLimit);
  const lines = [
    `<!-- IR_STORED_META ${JSON.stringify({ version: 3, roadmapId: state.roadmapId, revision: state.revision, baseRevision: state.baseRevision, goal: state.goal.summary, capability: state.capability, project: { origin: state.project.origin, managementMode: state.project.managementMode, hasFrontend: state.project.hasFrontend } })} -->`,
    `# Idiots Roadmap：${state.goal.summary}`,
    "",
    "## 现在需要你做什么",
    "",
    current.length === 0
      ? "本轮目标已经完成。除非你提出新目标或新变化，否则不需要再打开开发 Session。"
      : state.current.approval?.status !== "approved"
        ? "下一批还没有开始。先看下面的结果卡；符合你的需求就回复“开始下一轮”，不符合就直接说要改哪里。"
      : current.length === 1
        ? currentAction(current[0], state.current.approval)
        : current.every((item) => item.status === "awaiting_user")
          ? "不用打开新 Session。请分别体验下面已经完成的结果；全部通过后再让整合 Session 收口。"
          : `继续当前批次：只为仍待开发的工作打开新 Session；已经等待体验或被阻塞的工作不要重复开发。`,
    "",
    `当前进度：${progress(state)} 个工作项已经完成或通过技术复核。`,
  ];

  if (current.length > 0 && state.current.approval) {
    const approval = state.current.approval;
    lines.push(
      "",
      approval.status === "approved" ? "## ✅ 已批准的下一批" : "## 👀 下一轮建议",
      "",
      approval.summary,
      "",
      "完成后你会：",
    );
    for (const item of approval.visibleResults) lines.push(`- ${item}`);
    if (approval.nonGoals.length > 0) {
      lines.push("", "这轮不会做：");
      for (const item of approval.nonGoals) lines.push(`- ${item}`);
    }
    lines.push("", `为什么现在做：${approval.reason}`);
    if (approval.status === "proposed") {
      lines.push("", "符合你的需求就回复：`开始下一轮`。想调整时直接说：`调整：……`。", "");
    }
  }

  lines.push("", "## 版本保护", "", ...repositorySummary(state.repository));

  if (activeChanges.length > 0) {
    lines.push("", "## 当前变化", "");
    for (const change of activeChanges.slice(0, 3)) {
      lines.push(`- ${change.summary}`);
      if (change.unaffected.length > 0) lines.push(`  不受影响：${change.unaffected.join("、")}`);
      if (validText(change.decisionNeeded)) lines.push(`  需要决定：${change.decisionNeeded}`);
    }
  }

  if (current.length > 0) {
    lines.push("", `## 当前批次：第 ${state.current.batch} 批`, "");
    for (const work of current) lines.push(renderWorkItem(work), "");
  }

  lines.push("## 项目主轴", "", `完成标准：${state.goal.success}`);
  if (state.goal.nonGoals.length > 0) lines.push("", `本轮不做：${state.goal.nonGoals.join("、")}`);

  lines.push("", "## 里程碑", "");
  for (const milestone of state.milestones) {
    const icon = milestone.status === "completed" ? "✅" : milestone.status === "active" ? "▶️" : milestone.status === "superseded" ? "➖" : "○";
    lines.push(`- ${icon} ${milestone.title}：${milestone.outcome}`);
  }

  if (modules.length > 0) {
    lines.push("", "## 模块边界", "");
    for (const module of modules) lines.push(`- **${module.name}**：${module.responsibility}`);
    if (state.modules.length > modules.length) lines.push(`- 其余 ${state.modules.length - modules.length} 个模块由 AI 在项目状态中维护，用户无需阅读。`);
  }

  if (completed.length > 0) {
    lines.push("", "## 最近完成", "");
    for (const work of completed) {
      const result = work.status === "technical_verified" ? "AI 技术复核一致" : "用户体验通过";
      lines.push(`- ${work.title}（${result}）`);
    }
  }

  lines.push("", "---", "", "完整模块、接口、证据和历史由 AI 保存在 `.idiotsroadmap/state.json`；你不需要阅读或维护它。", "");
  return lines.join("\n");
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolvePaths(projectRoot) {
  const root = fs.realpathSync(path.resolve(projectRoot));
  const control = path.join(root, ".idiotsroadmap");
  const archive = path.join(control, "archive");
  const runtime = path.join(control, "runtime");
  if (fs.existsSync(control) && fs.lstatSync(control).isSymbolicLink()) {
    throw new Error(".idiotsroadmap 是符号链接，已拒绝使用。");
  }
  fs.mkdirSync(control, { recursive: true });
  if (!isInside(root, fs.realpathSync(control))) throw new Error("控制目录指向项目外部。");
  for (const directory of [archive, runtime]) {
    if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) {
      throw new Error(`${path.basename(directory)} 是符号链接，已拒绝使用。`);
    }
    fs.mkdirSync(directory, { recursive: true });
    if (!isInside(root, fs.realpathSync(directory))) throw new Error(`${path.basename(directory)} 指向项目外部。`);
  }
  const paths = {
    root,
    control,
    roadmap: path.join(root, "IDIOTS_ROADMAP.md"),
    state: path.join(control, "state.json"),
    archive,
    runtime,
    lock: path.join(control, "roadmap.lock"),
  };
  for (const candidate of [paths.roadmap, paths.state, paths.lock, paths.archive, paths.runtime]) {
    if (!isInside(root, candidate)) throw new Error("Roadmap 路径越过项目根目录。");
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isSymbolicLink()) {
      throw new Error(`${path.basename(candidate)} 是符号链接，已拒绝使用。`);
    }
  }
  return paths;
}

function atomicWrite(target, content) {
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, target);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch { /* renamed or best-effort cleanup */ }
  }
}

function ensureProjectRuntime(paths) {
  const sourceEngine = fileURLToPath(import.meta.url);
  if (path.resolve(path.dirname(sourceEngine)) === path.resolve(paths.runtime)) return;
  const adjacentRunner = path.resolve(path.dirname(sourceEngine), "roadmap-state.mjs");
  const repositoryRunner = path.resolve(path.dirname(sourceEngine), "../../scripts/roadmap-state.mjs");
  const sourceRunner = fs.existsSync(adjacentRunner) ? adjacentRunner : repositoryRunner;
  if (!fs.existsSync(sourceRunner)) {
    throw new Error("找不到 Roadmap 便携式运行工具，未写入任何项目状态。");
  }
  const runner = fs.readFileSync(sourceRunner, "utf8").replace(
    'from "../hooks/lib/project-state.mjs";',
    'from "./project-state.mjs";',
  );
  atomicWrite(path.join(paths.runtime, "project-state.mjs"), fs.readFileSync(sourceEngine, "utf8"));
  atomicWrite(path.join(paths.runtime, "roadmap-state.mjs"), runner);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`项目状态无法读取：${error.message}`);
  }
}

function timestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function safeSlug(value) {
  return String(value).normalize("NFKC").replace(/[<>:"/\\|?*\u0000-\u001F]/gu, "-").replace(/\s+/gu, "-").replace(/-+/gu, "-").replace(/^[.-]+|[.-]+$/gu, "").slice(0, 60) || "roadmap";
}

function archiveExisting(paths, state, date) {
  if (!fs.existsSync(paths.roadmap) && !fs.existsSync(paths.state)) return null;
  const stem = `${timestamp(date)}-${safeSlug(state?.goal?.summary || "legacy-roadmap")}`;
  let suffix = 1;
  let roadmapTarget;
  do {
    roadmapTarget = path.join(paths.archive, `${stem}${suffix === 1 ? "" : `-${suffix}`}.md`);
    suffix += 1;
  } while (fs.existsSync(roadmapTarget));
  if (fs.existsSync(paths.roadmap)) fs.copyFileSync(paths.roadmap, roadmapTarget, fs.constants.COPYFILE_EXCL);
  if (fs.existsSync(paths.state)) fs.copyFileSync(paths.state, roadmapTarget.replace(/\.md$/u, ".state.json"), fs.constants.COPYFILE_EXCL);
  return roadmapTarget;
}

function legacyCompletedStepIds(roadmapFile) {
  let markdown;
  try { markdown = fs.readFileSync(roadmapFile, "utf8"); }
  catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const ids = [];
  for (const match of markdown.matchAll(/<!--\s*IR_STEP\s+(\{[^\r\n]*\})\s*-->/gu)) {
    try {
      const step = JSON.parse(match[1]);
      if (step.status === "completed" && validText(step.id)) ids.push(step.id);
    } catch {
      throw new Error("旧 Roadmap 的已完成步骤无法读取，迁移已停止。");
    }
  }
  return ids;
}

function assertLegacyHistoryMigrated(paths, state) {
  const completed = legacyCompletedStepIds(paths.roadmap);
  const represented = new Set(
    state.workItems.map((item) => item.legacyStepId).filter((value) => validText(value)),
  );
  for (const id of completed) {
    if (!represented.has(id)) throw new Error(`迁移缺少旧已完成步骤 ${id}；旧文件保持不变。`);
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function assertImmutableHistory(previous, incoming) {
  const nextWork = new Map(incoming.workItems.map((item) => [item.id, item]));
  for (const item of previous.workItems || []) {
    const next = nextWork.get(item.id);
    if (!next) throw new Error(`工作项 ${item.id} 不得删除；不再执行时请标为 superseded。`);
    if (!["accepted", "technical_verified"].includes(item.status)) continue;
    if (!next || JSON.stringify(canonical(next)) !== JSON.stringify(canonical(item))) {
      throw new Error(`已完成工作 ${item.id} 不得删除或改写。`);
    }
  }
  const nextDecisions = new Map((incoming.decisions || []).map((item) => [item.id, item]));
  for (const decision of previous.decisions || []) {
    if (decision.source !== "user") continue;
    const next = nextDecisions.get(decision.id);
    if (!next || JSON.stringify(canonical(next)) !== JSON.stringify(canonical(decision))) {
      throw new Error(`用户决定 ${decision.id} 不得被自动覆盖。`);
    }
  }
}

function assertStatusTransitions(previous, incoming) {
  const nextWork = new Map(incoming.workItems.map((item) => [item.id, item]));
  for (const item of previous.workItems || []) {
    const next = nextWork.get(item.id);
    if (!next) continue;
    if (!WORK_TRANSITIONS.get(item.status)?.has(next.status)) {
      throw new Error(`工作项 ${item.id} 不能从 ${item.status} 变为 ${next.status}。`);
    }
  }
}

function approvalCard(approval) {
  if (!approval) return null;
  return canonical({
    proposalId: approval.proposalId,
    batch: approval.batch,
    workItemIds: approval.workItemIds,
    summary: approval.summary,
    visibleResults: approval.visibleResults,
    nonGoals: approval.nonGoals,
    reason: approval.reason,
    proposedAtRevision: approval.proposedAtRevision,
  });
}

function approvedUserScope(state, approval) {
  const byId = new Map((state.workItems || []).map((item) => [item.id, item]));
  return (approval?.workItemIds || []).map((id) => {
    const item = byId.get(id);
    return item
      ? canonical({
          id,
          title: item.title,
          outcome: item.outcome,
          dataMode: item.dataMode,
          acceptance: item.completion?.acceptance || [],
        })
      : { id, missing: true };
  });
}

function assertApprovalTransition(previous, incoming, allowApproval) {
  const before = previous.current?.approval || null;
  const after = incoming.current?.approval || null;
  if (after?.status === "approved" && before?.status !== "approved" && !allowApproval) {
    throw new Error("只有用户明确批准后运行 approve 命令，才能把下一批标为 approved。");
  }
  if (before?.status === "proposed" && after?.status === "approved") {
    if (JSON.stringify(approvalCard(before)) !== JSON.stringify(approvalCard(after))) {
      throw new Error("批准时下一批结果卡发生了变化，请重新展示给用户。 ");
    }
  }
  if (before?.status === "approved" && after?.status === "approved") {
    if (JSON.stringify(approvalCard(before)) !== JSON.stringify(approvalCard(after))) {
      throw new Error("已批准批次的用户结果或边界发生变化，必须先生成新的 proposed 提案。 ");
    }
    if (JSON.stringify(approvedUserScope(previous, before)) !== JSON.stringify(approvedUserScope(incoming, after))) {
      throw new Error("已批准工作项的用户结果发生变化，必须重新交给用户批准。 ");
    }
  }
  if (before?.status === "approved" && after?.status === "proposed" && before.proposalId === after.proposalId) {
    throw new Error("新的下一批提案必须使用新的 proposalId。 ");
  }
}

function withLock(file, operation) {
  let descriptor;
  try { descriptor = fs.openSync(file, "wx", 0o600); }
  catch (error) {
    if (error.code === "EEXIST") throw new Error("另一个 Session 正在更新 Roadmap，请重新读取最新状态。");
    throw error;
  }
  try { return operation(); }
  finally {
    fs.closeSync(descriptor);
    try { fs.unlinkSync(file); } catch { /* best effort */ }
  }
}

function writePair(paths, roadmap, state) {
  const oldRoadmap = fs.existsSync(paths.roadmap) ? fs.readFileSync(paths.roadmap, "utf8") : null;
  const oldState = fs.existsSync(paths.state) ? fs.readFileSync(paths.state, "utf8") : null;
  atomicWrite(paths.roadmap, roadmap);
  try { atomicWrite(paths.state, `${JSON.stringify(state, null, 2)}\n`); }
  catch (error) {
    if (oldRoadmap === null) { try { fs.unlinkSync(paths.roadmap); } catch { /* absent */ } }
    else atomicWrite(paths.roadmap, oldRoadmap);
    if (oldState === null) { try { fs.unlinkSync(paths.state); } catch { /* absent */ } }
    else atomicWrite(paths.state, oldState);
    throw error;
  }
}

export function persistProjectState({ projectRoot, metadata, state, now = new Date(), allowApproval = false }) {
  const validation = validateProjectState(state, metadata);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  const paths = resolvePaths(projectRoot);
  return withLock(paths.lock, () => {
    const previous = readJson(paths.state);
    const previousIsV3 = previous?.schemaVersion === 3;
    const hasExistingArtifacts = fs.existsSync(paths.roadmap) || fs.existsSync(paths.state);
    let transition = "new";
    let archive = null;

    if (previousIsV3) {
      if (metadata.action === "new") {
        if (previous.roadmapId === state.roadmapId || previous.goal?.summary === state.goal.summary) {
          throw new Error("现有目标不能用 action:new 覆盖；请基于当前 revision 更新。 ");
        }
        archive = archiveExisting(paths, previous, now);
        transition = "new-goal";
      } else {
        if (previous.roadmapId !== state.roadmapId) throw new Error("Roadmap 身份不一致，拒绝覆盖。");
        if (state.baseRevision !== previous.revision || state.revision !== previous.revision + 1) {
          throw new Error(`Roadmap 已更新到 revision ${previous.revision}；当前 Session 基于 revision ${state.baseRevision}，已拒绝覆盖。`);
        }
        assertImmutableHistory(previous, state);
        assertStatusTransitions(previous, state);
        assertApprovalTransition(previous, state, allowApproval);
        transition = "update";
      }
    } else if (metadata.action === "update") {
      if (state.revision !== 1 || state.baseRevision !== null || ![1, 2].includes(state.migration?.fromVersion)) {
        throw new Error("旧 Roadmap 首次迁移必须使用 revision:1、baseRevision:null，并声明 migration.fromVersion。 ");
      }
      assertLegacyHistoryMigrated(paths, state);
      archive = archiveExisting(paths, previous, now);
      transition = "migration";
    } else {
      if (state.revision !== 1 || state.baseRevision !== null) {
        throw new Error("新 Roadmap 必须使用 revision:1 和 baseRevision:null。 ");
      }
      if (hasExistingArtifacts) {
        archive = archiveExisting(paths, previous, now);
        transition = "new-goal";
      }
    }

    ensureProjectRuntime(paths);
    const roadmap = renderRoadmap(state);
    writePair(paths, roadmap, state);
    return { target: paths.roadmap, state: paths.state, runtime: paths.runtime, archive, unchanged: false, transition, revision: state.revision };
  });
}

function nextRevision(state) {
  const updated = structuredClone(state);
  updated.baseRevision = state.revision;
  updated.revision = state.revision + 1;
  return updated;
}

function currentStateFromRoot(projectRoot) {
  const paths = resolvePaths(projectRoot);
  const state = readJson(paths.state);
  if (!state) throw new Error("没有找到 Idiots Roadmap 状态。请先进入 Plan 模式运行 $idiots-roadmap。");
  const validation = validateProjectState(state);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  return { paths, state };
}

function legacyProposal(state) {
  const items = state.workItems.filter((item) => state.current.workItemIds.includes(item.id));
  return {
    proposalId: `proposal_${crypto.randomBytes(8).toString("hex")}`,
    status: "proposed",
    batch: state.current.batch,
    workItemIds: [...state.current.workItemIds],
    summary: items.length === 1 ? items[0].title : `完成第 ${state.current.batch} 批的 ${items.length} 项工作`,
    visibleResults: items.slice(0, 2).map((item) => item.outcome),
    nonGoals: [...(state.goal.nonGoals || [])].slice(0, 3),
    reason: "这是当前 Roadmap 中依赖已经满足的下一批工作。",
    proposedAtRevision: state.revision,
    approvedAtRevision: null,
  };
}

export function approveCurrentBatch(projectRoot) {
  const { state } = currentStateFromRoot(projectRoot);
  if (state.current.workItemIds.length === 0) throw new Error("当前目标已经完成，没有需要批准的下一批。 ");
  const updated = nextRevision(state);
  const before = state.current.approval || legacyProposal(state);
  if (before.status === "approved") {
    return { unchanged: true, revision: state.revision, proposalId: before.proposalId };
  }
  updated.current.approval = {
    ...structuredClone(before),
    status: "approved",
    approvedAtRevision: updated.revision,
  };
  const current = new Set(updated.current.workItemIds);
  for (const item of updated.workItems) {
    if (current.has(item.id) && item.status === "planned") item.status = "ready";
  }
  const result = persistProjectState({
    projectRoot,
    metadata: {
      version: 3,
      action: "update",
      roadmapId: updated.roadmapId,
      revision: updated.revision,
      baseRevision: updated.baseRevision,
    },
    state: updated,
    allowApproval: true,
  });
  return { ...result, proposalId: updated.current.approval.proposalId };
}

export function claimCurrentWork({ projectRoot, workItemId = null, reclaim = false }) {
  const { state } = currentStateFromRoot(projectRoot);
  if (state.current.approval?.status !== "approved") {
    throw new Error("下一批尚未得到用户批准。请先展示结果卡并在用户明确同意后运行 approve。 ");
  }
  const current = new Set(state.current.workItemIds);
  let work = workItemId ? state.workItems.find((item) => item.id === workItemId) : null;
  if (workItemId && (!work || !current.has(workItemId))) throw new Error("指定工作不属于当前批次。 ");
  if (!work) work = state.workItems.find((item) => current.has(item.id) && item.status === "ready");
  if (!work) throw new Error("当前没有可领取的工作；它可能已被其他 Session 领取或正在等待体验。 ");
  if (reclaim) {
    if (!new Set(["in_progress", "blocked"]).has(work.status)) throw new Error("只有中断或阻塞的工作可以重新领取。 ");
  } else if (work.status !== "ready") {
    throw new Error(`工作 ${work.id} 当前是 ${work.status}，不能重复领取。`);
  }
  const updated = nextRevision(state);
  const target = updated.workItems.find((item) => item.id === work.id);
  const oldClaim = target.claim?.id || null;
  target.status = "in_progress";
  target.blocker = "";
  target.claim = {
    id: `claim_${crypto.randomBytes(8).toString("hex")}`,
    startedAtRevision: updated.revision,
    ...(oldClaim ? { reclaimedFrom: oldClaim } : {}),
  };
  const result = persistProjectState({
    projectRoot,
    metadata: {
      version: 3,
      action: "update",
      roadmapId: updated.roadmapId,
      revision: updated.revision,
      baseRevision: updated.baseRevision,
    },
    state: updated,
  });
  return {
    ...result,
    workItemId: target.id,
    title: target.title,
    claimId: target.claim.id,
  };
}

export { APPLY_COMMAND, HANDOFF_GUARD };
