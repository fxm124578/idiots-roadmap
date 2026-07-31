import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BEGIN = /<!--\s*IDIOTS_ROADMAP:BEGIN\s+(\{[^\r\n]*\})\s*-->/;
const END = /<!--\s*IDIOTS_ROADMAP:END\s*-->/;
const OPTOUT = /<!--\s*IDIOTS_ROADMAP:OPTOUT\s*-->/;
const STEP_START = /<!--\s*IR_STEP\s+(\{[^\r\n]*\})\s*-->/g;
const STEP_END = /<!--\s*IR_STEP_END\s*-->/g;
const REQUIRED_SECTIONS = ["goal", "capability", "progress", "usage", "git", "sessions", "steps"];
const REQUIRED_FIELDS = ["session", "git", "prompt", "boundaries", "acceptance", "checklist", "reply"];
const ALLOWED_STATUS = new Set(["pending", "in_progress", "awaiting_acceptance", "completed"]);
const ALLOWED_KIND = new Set(["frontend", "backend", "integration", "cli", "report", "migration", "infrastructure", "other"]);
const ALLOWED_EVIDENCE = new Set(["ui", "sample-io", "report", "code", "diff"]);
const ALLOWED_DATA = new Set(["none", "mock", "real"]);
const ALLOWED_EXECUTION = new Set(["serial", "parallel"]);
const ALLOWED_GIT_ACTION = new Set([
  "stay",
  "create-integration-branch",
  "create-branch",
  "merge-branches",
  "initialize",
  "prepare-baseline",
]);
const ALLOWED_PUSH = new Set(["none", "after-acceptance-with-approval"]);
const ALLOWED_REMOTE_PROVIDER = new Set(["github", "other", "none"]);
const ALLOWED_WORKING_TREE = new Set(["clean", "dirty", "unknown"]);
const REQUIRED_GUARD = "<!-- IR_GUARD:current-step-only,run-checks,stop-for-acceptance -->";
const REQUIRED_SESSION_GUARD = "<!-- IR_SESSION_GUARD:file-scope,no-cross-session-edits,stop-on-conflict -->";
const REQUIRED_GIT_GUARD = "<!-- IR_GIT_GUARD:commit-after-acceptance,no-auto-push,preserve-user-changes -->";

export function findRoadmapPayload(input) {
  const preferredKeys = [
    "last_assistant_message",
    "lastAssistantMessage",
    "plan",
    "message",
    "content",
    "text",
    "tool_input",
    "toolInput",
  ];
  const seen = new Set();

  function visit(value, depth = 0) {
    if (depth > 6 || value === null || value === undefined) return null;
    if (typeof value === "string") {
      if (OPTOUT.test(value) || (BEGIN.test(value) && END.test(value))) return value;
      return null;
    }
    if (typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);

    for (const key of preferredKeys) {
      if (Object.hasOwn(value, key)) {
        const found = visit(value[key], depth + 1);
        if (found) return found;
      }
    }
    for (const valuePart of Object.values(value)) {
      const found = visit(valuePart, depth + 1);
      if (found) return found;
    }
    return null;
  }

  return visit(input);
}

export function parseEnvelope(text) {
  if (!text) return { type: "none" };
  if (OPTOUT.test(text)) return { type: "optout" };
  const begin = BEGIN.exec(text);
  if (!begin) return { type: "none" };
  const afterBegin = begin.index + begin[0].length;
  const remainder = text.slice(afterBegin);
  const end = END.exec(remainder);
  if (!end) throw new Error("Roadmap 缺少 IDIOTS_ROADMAP:END 标记。");

  let metadata;
  try {
    metadata = JSON.parse(begin[1]);
  } catch {
    throw new Error("BEGIN 标记中的 JSON 无法解析。");
  }

  return {
    type: "roadmap",
    metadata,
    markdown: remainder.slice(0, end.index).trim() + "\n",
  };
}

function parseJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label} 的 JSON 无法解析。`);
  }
}

function sectionContent(markdown, name) {
  const marker = `<!-- IR_SECTION:${name} -->`;
  const start = markdown.indexOf(marker);
  if (start < 0) return null;
  const contentStart = start + marker.length;
  const next = markdown.indexOf("<!-- IR_SECTION:", contentStart);
  return markdown.slice(contentStart, next < 0 ? markdown.length : next).trim();
}

export function parseSteps(markdown) {
  const starts = [...markdown.matchAll(STEP_START)];
  const ends = [...markdown.matchAll(STEP_END)];
  if (starts.length !== ends.length) throw new Error("IR_STEP 与 IR_STEP_END 数量不一致。");

  return starts.map((start, index) => {
    const end = ends.find((candidate) => candidate.index > start.index);
    if (!end) throw new Error(`第 ${index + 1} 个步骤缺少 IR_STEP_END。`);
    if (index + 1 < starts.length && end.index > starts[index + 1].index) {
      throw new Error(`第 ${index + 1} 个步骤标记发生嵌套。`);
    }
    return {
      metadata: parseJson(start[1], `第 ${index + 1} 个 IR_STEP`),
      start: start.index,
      end: end.index + end[0].length,
      raw: markdown.slice(start.index, end.index + end[0].length),
    };
  });
}

function fieldContent(step, field) {
  const marker = `<!-- IR_FIELD:${field} -->`;
  const start = step.raw.indexOf(marker);
  if (start < 0) return null;
  const contentStart = start + marker.length;
  const nextField = step.raw.indexOf("<!-- IR_FIELD:", contentStart);
  const stepEnd = step.raw.indexOf("<!-- IR_STEP_END", contentStart);
  const end = nextField >= 0 ? nextField : stepEnd;
  return step.raw.slice(contentStart, end).trim();
}

function validateStepDisplayFormat(step, label) {
  const errors = [];
  const requiredEmojis = ["🧩", "📋", "🎯", "⚠️", "🚧", "✅", "☑️", "💬"];
  const missingEmojis = requiredEmojis.filter((emoji) => !step.raw.includes(emoji));
  if (missingEmojis.length > 0) {
    errors.push(`${label} 缺少固定标题图标：${missingEmojis.join(" ")}。`);
  }
  const firstLineAfterMetadata = step.raw
    .slice(step.raw.indexOf("-->") + 3)
    .trimStart()
    .split(/\r?\n/, 1)[0];
  if (!/^\*\*.+\*\*$/.test(firstLineAfterMetadata)) {
    errors.push(`${label} 必须使用加粗的子步骤标题。`);
  }

  const session = step.raw.indexOf("<!-- IR_FIELD:session -->");
  const git = step.raw.indexOf("<!-- IR_FIELD:git -->");
  const prompt = step.raw.indexOf("<!-- IR_FIELD:prompt -->");
  const boundaries = step.raw.indexOf("<!-- IR_FIELD:boundaries -->");
  const acceptance = step.raw.indexOf("<!-- IR_FIELD:acceptance -->");
  const checklist = step.raw.indexOf("<!-- IR_FIELD:checklist -->");
  const reply = step.raw.indexOf("<!-- IR_FIELD:reply -->");
  const fenceMatches = [...step.raw.matchAll(/^```(?:text)?\s*$/gm)];
  if (fenceMatches.length !== 2) {
    errors.push(`${label} 必须恰好包含一个提示词代码块。`);
    return errors;
  }

  const fenceOpen = fenceMatches[0].index;
  const fenceClose = fenceMatches[1].index;
  const promptIntro = step.raw.slice(prompt, fenceOpen);
  if (!promptIntro.includes("📋")) {
    errors.push(`${label} 的第 1 步复制提示词说明前必须包含 📋。`);
  }
  if (
    !(
      prompt < fenceOpen &&
      session < prompt &&
      git > session &&
      git < prompt &&
      fenceOpen < boundaries &&
      boundaries < acceptance &&
      acceptance < fenceClose &&
      fenceClose < checklist &&
      checklist < reply
    )
  ) {
    errors.push(
      `${label} 的顺序必须为：第 1 步提示词 → 代码块内边界和验收 → 第 2 步人工清单 → 第 3 步回复。`,
    );
  }
  return errors;
}

function validateBranchName(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 120 &&
    !value.startsWith("/") &&
    !value.endsWith("/") &&
    !value.endsWith(".") &&
    !value.endsWith(".lock") &&
    !value.includes("..") &&
    !value.includes("//") &&
    !value.includes("@{") &&
    !/[\s~^:?*[\]\\\u0000-\u001F\u007F]/u.test(value)
  );
}

function validateFileScope(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const scope = value.trim();
  if (
    scope.includes("\\") ||
    scope.includes("\0") ||
    scope.startsWith("/") ||
    /^[A-Za-z]:/.test(scope) ||
    scope.split("/").includes("..")
  ) {
    return false;
  }
  const wildcard = scope.indexOf("*");
  if (wildcard >= 0 && !scope.endsWith("/**") && !scope.endsWith("/*")) return false;
  return !/[?[\]]/.test(scope);
}

function scopeRoot(value) {
  return value.trim().replace(/\/\*{1,2}$/, "").replace(/\/+$/, "") || ".";
}

function scopesOverlap(left, right) {
  const leftRoot = scopeRoot(left);
  const rightRoot = scopeRoot(right);
  if (leftRoot === "." || rightRoot === ".") return true;
  return (
    leftRoot === rightRoot ||
    leftRoot.startsWith(`${rightRoot}/`) ||
    rightRoot.startsWith(`${leftRoot}/`)
  );
}

function listItems(content, checkbox = false) {
  const pattern = checkbox ? /^\s*[-*+]\s+\[\s\]\s+(.+?)\s*$/ : /^\s*(?:[-*+]|\d+\.)\s+(?!\[\s\])(.+?)\s*$/;
  return content
    .split(/\r?\n/)
    .map((line) => line.match(pattern)?.[1])
    .filter(Boolean);
}

export function validateRoadmap(envelope) {
  const errors = [];
  const { metadata, markdown } = envelope;

  if (metadata?.version !== 1) errors.push("version 必须为 1。");
  if (!["new", "update"].includes(metadata?.action)) errors.push("action 必须为 new 或 update。");
  if (!metadata?.goal || typeof metadata.goal !== "string") errors.push("goal 必须是非空字符串。");
  if (!metadata?.capability?.description) errors.push("缺少 capability.description。");
  if (!["no-code", "code-reader", "custom"].includes(metadata?.capability?.mode)) {
    errors.push("capability.mode 必须为 no-code、code-reader 或 custom。");
  }
  if (typeof metadata?.project?.hasFrontend !== "boolean") {
    errors.push("project.hasFrontend 必须为布尔值。");
  }
  if (typeof metadata?.repository?.isGitRepo !== "boolean") {
    errors.push("repository.isGitRepo 必须为布尔值。");
  }
  if (!ALLOWED_WORKING_TREE.has(metadata?.repository?.workingTree)) {
    errors.push("repository.workingTree 必须为 clean、dirty 或 unknown。");
  }
  if (
    metadata?.repository?.currentBranch !== null &&
    !validateBranchName(metadata?.repository?.currentBranch)
  ) {
    errors.push("repository.currentBranch 必须为安全的分支名或 null。");
  }
  if (!ALLOWED_REMOTE_PROVIDER.has(metadata?.repository?.remoteProvider)) {
    errors.push("repository.remoteProvider 必须为 github、other 或 none。");
  }
  if (metadata?.repository?.remoteProvider === "none") {
    if (metadata?.repository?.remoteName !== null) {
      errors.push("没有远程仓库时 repository.remoteName 必须为 null。");
    }
  } else if (!metadata?.repository?.remoteName || typeof metadata.repository.remoteName !== "string") {
    errors.push("存在远程仓库时必须提供 repository.remoteName。");
  }
  if (!validateBranchName(metadata?.repository?.integrationBranch)) {
    errors.push("repository.integrationBranch 不是安全的 Git 分支名。");
  }
  if (metadata?.repository?.pushPolicy !== "manual-after-final-acceptance") {
    errors.push("repository.pushPolicy 必须为 manual-after-final-acceptance。");
  }
  if (!metadata?.language || typeof metadata.language !== "string") errors.push("缺少 language。");
  if (Buffer.byteLength(markdown, "utf8") > 1_000_000) errors.push("Roadmap 超过 1 MB。");

  for (const section of REQUIRED_SECTIONS) {
    const content = sectionContent(markdown, section);
    if (!content) errors.push(`缺少或留空 IR_SECTION:${section}。`);
  }

  let steps = [];
  try {
    steps = parseSteps(markdown);
  } catch (error) {
    errors.push(error.message);
  }
  if (steps.length === 0) errors.push("Roadmap 至少需要一个步骤。");

  const ids = new Set();
  const labels = new Set();
  const stepIndexes = new Map();
  const batches = new Map();
  const parallelBranches = new Set();
  steps.forEach((step, index) => {
    const expectedId = `step-${String(index + 1).padStart(2, "0")}`;
    const meta = step.metadata;
    if (meta.id !== expectedId) errors.push(`第 ${index + 1} 步 ID 应为 ${expectedId}。`);
    if (ids.has(meta.id)) errors.push(`步骤 ID 重复：${meta.id}。`);
    ids.add(meta.id);
    stepIndexes.set(meta.id, index);
    if (!meta.label || typeof meta.label !== "string") errors.push(`${meta.id || expectedId} 缺少用户可见 label。`);
    if (labels.has(meta.label)) errors.push(`子步骤 label 重复：${meta.label}。`);
    labels.add(meta.label);
    if (!ALLOWED_STATUS.has(meta.status)) errors.push(`${meta.id || expectedId} 的 status 无效。`);
    if (!ALLOWED_KIND.has(meta.kind)) errors.push(`${meta.id || expectedId} 的 kind 无效。`);
    if (!ALLOWED_EVIDENCE.has(meta.evidence)) errors.push(`${meta.id || expectedId} 的 evidence 无效。`);
    if (!ALLOWED_DATA.has(meta.data)) errors.push(`${meta.id || expectedId} 的 data 无效。`);
    if (!Number.isInteger(meta.batch) || meta.batch < 1) {
      errors.push(`${meta.id || expectedId} 的 batch 必须是正整数。`);
    } else {
      if (index > 0 && Number.isInteger(steps[index - 1].metadata.batch) && meta.batch < steps[index - 1].metadata.batch) {
        errors.push(`${meta.id || expectedId} 的 batch 不能小于前一步。`);
      }
      if (!batches.has(meta.batch)) batches.set(meta.batch, []);
      batches.get(meta.batch).push(step);
    }
    if (!ALLOWED_EXECUTION.has(meta.execution)) {
      errors.push(`${meta.id || expectedId} 的 execution 必须为 serial 或 parallel。`);
    }
    if (!ALLOWED_GIT_ACTION.has(meta.gitAction)) {
      errors.push(`${meta.id || expectedId} 的 gitAction 无效。`);
    }
    if (!validateBranchName(meta.branch)) {
      errors.push(`${meta.id || expectedId} 的 branch 不是安全的 Git 分支名。`);
    }
    if (!ALLOWED_PUSH.has(meta.push)) {
      errors.push(`${meta.id || expectedId} 的 push 无效。`);
    }
    if (!Array.isArray(meta.dependsOn)) {
      errors.push(`${meta.id || expectedId} 的 dependsOn 必须是数组。`);
    } else {
      for (const dependency of meta.dependsOn) {
        const dependencyIndex = stepIndexes.get(dependency);
        if (dependencyIndex === undefined) {
          errors.push(`${meta.id || expectedId} 的前置步骤 ${dependency} 必须出现在当前步骤之前。`);
        } else if (
          Number.isInteger(meta.batch) &&
          Number.isInteger(steps[dependencyIndex].metadata.batch) &&
          steps[dependencyIndex].metadata.batch >= meta.batch
        ) {
          errors.push(`${meta.id || expectedId} 必须安排在前置步骤 ${dependency} 之后的批次。`);
        }
      }
    }
    if (!Array.isArray(meta.files) || meta.files.length === 0) {
      errors.push(`${meta.id || expectedId} 必须声明允许修改的 files 范围。`);
    } else {
      for (const fileScope of meta.files) {
        if (!validateFileScope(fileScope)) {
          errors.push(`${meta.id || expectedId} 的文件范围无效：${String(fileScope)}。`);
        }
      }
    }
    errors.push(...validateStepDisplayFormat(step, meta.id || expectedId));

    for (const field of REQUIRED_FIELDS) {
      if (!fieldContent(step, field)) errors.push(`${meta.id || expectedId} 缺少或留空 IR_FIELD:${field}。`);
    }
    const prompt = fieldContent(step, "prompt") || "";
    if (!prompt.includes(REQUIRED_GUARD)) errors.push(`${meta.id || expectedId} 的提示词缺少 IR_GUARD。`);
    if (!prompt.includes(REQUIRED_SESSION_GUARD)) {
      errors.push(`${meta.id || expectedId} 的提示词缺少 IR_SESSION_GUARD。`);
    }
    if (!prompt.includes(REQUIRED_GIT_GUARD)) {
      errors.push(`${meta.id || expectedId} 的提示词缺少 IR_GIT_GUARD。`);
    }
    const session = fieldContent(step, "session") || "";
    const expectedSessionIcon = meta.execution === "parallel" ? "🔀" : "➡️";
    if (!session.includes(expectedSessionIcon) || !session.includes(`第 ${meta.batch} 批`)) {
      errors.push(`${meta.id || expectedId} 的 Session 标记必须与 execution 和 batch 一致。`);
    }
    for (const fileScope of Array.isArray(meta.files) ? meta.files : []) {
      if (!session.includes(fileScope)) {
        errors.push(`${meta.id || expectedId} 的 Session 标记缺少文件范围 ${fileScope}。`);
      }
    }
    const git = fieldContent(step, "git") || "";
    if (!git.includes(meta.branch)) {
      errors.push(`${meta.id || expectedId} 的 Git 标记缺少分支 ${meta.branch}。`);
    }
    const gitActionText = {
      stay: "整合分支",
      "create-integration-branch": "新建整合分支",
      "create-branch": "新建独立分支",
      "merge-branches": "合并",
      initialize: "初始化本地 Git",
      "prepare-baseline": "保护现有改动",
    }[meta.gitAction];
    const gitIcon = meta.gitAction === "merge-branches" ? "🔗" : "🌿";
    if (!git.includes(gitIcon) || (gitActionText && !git.includes(gitActionText))) {
      errors.push(`${meta.id || expectedId} 的 Git 标记必须与 gitAction 一致。`);
    }
    const expectedPushText = meta.push === "none" ? "不推送" : "明确同意后才推送";
    if (!git.includes(expectedPushText)) {
      errors.push(`${meta.id || expectedId} 的 Git 标记与 push 策略不一致。`);
    }
    const acceptance = fieldContent(step, "acceptance") || "";
    const acceptanceItems = listItems(acceptance);
    const acceptanceCount = acceptanceItems.length;
    if (acceptanceCount < 1 || acceptanceCount > 2) {
      errors.push(`${meta.id || expectedId} 的用户验收必须为 1–2 项，当前为 ${acceptanceCount} 项。`);
    }
    const checklistItems = listItems(fieldContent(step, "checklist") || "", true);
    if (checklistItems.length !== acceptanceCount || checklistItems.some((item, itemIndex) => item !== acceptanceItems[itemIndex])) {
      errors.push(`${meta.id || expectedId} 的人工验收清单必须与提示词内验收标准逐项一致。`);
    }
    const reply = fieldContent(step, "reply") || "";
    if (meta.label && !reply.includes(`${meta.label} 通过，请继续。`)) {
      errors.push(`${meta.id || expectedId} 的第 3 步回复必须包含“${meta.label} 通过，请继续。”。`);
    }
    if (metadata?.capability?.mode === "no-code" && ["code", "diff"].includes(meta.evidence)) {
      errors.push(`${meta.id || expectedId} 在完全不看代码模式下不能使用 ${meta.evidence} 验收。`);
    }
  });

  const firstGitAction = steps[0]?.metadata.gitAction;
  if (metadata?.repository?.isGitRepo === false && firstGitAction !== "initialize") {
    errors.push("当前不是 Git 仓库时，第一步必须初始化本地 Git 并建立基线。");
  } else if (
    metadata?.repository?.isGitRepo === true &&
    (["dirty", "unknown"].includes(metadata?.repository?.workingTree) ||
      metadata?.repository?.currentBranch === null) &&
    firstGitAction !== "prepare-baseline"
  ) {
    errors.push("工作区不是 clean 基线时，第一步必须使用 prepare-baseline 保护现有改动。");
  } else if (
    metadata?.repository?.isGitRepo === true &&
    metadata?.repository?.workingTree === "clean" &&
    metadata?.repository?.currentBranch !== metadata?.repository?.integrationBranch &&
    firstGitAction !== "create-integration-branch"
  ) {
    errors.push("当前不在整合分支时，第一步必须创建并切换到 integrationBranch。");
  }

  for (const [batch, batchSteps] of batches) {
    if (batchSteps.length === 1) {
      if (batchSteps[0].metadata.execution !== "serial") {
        errors.push(`第 ${batch} 批只有一个步骤，不能标记为 parallel。`);
      }
      continue;
    }
    if (batchSteps.length > 3) errors.push(`第 ${batch} 批并行 Session 不得超过 3 个。`);
    if (batchSteps.some((step) => step.metadata.execution !== "parallel")) {
      errors.push(`第 ${batch} 批包含多个步骤时，所有步骤都必须标记为 parallel。`);
    }
    for (const step of batchSteps) {
      if (step.metadata.gitAction !== "create-branch") {
        errors.push(`${step.metadata.id} 是并行步骤，gitAction 必须为 create-branch。`);
      }
      if (step.metadata.branch === metadata?.repository?.integrationBranch) {
        errors.push(`${step.metadata.id} 的并行分支不能与整合分支相同。`);
      }
      if (parallelBranches.has(step.metadata.branch)) {
        errors.push(`并行分支重复：${step.metadata.branch}。`);
      }
      parallelBranches.add(step.metadata.branch);
      if (step.metadata.push !== "none") {
        errors.push(`${step.metadata.id} 的并行分支不得单独推送。`);
      }
    }
    for (let leftIndex = 0; leftIndex < batchSteps.length; leftIndex += 1) {
      const left = batchSteps[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < batchSteps.length; rightIndex += 1) {
        const right = batchSteps[rightIndex];
        const leftFiles = Array.isArray(left.metadata.files) ? left.metadata.files : [];
        const rightFiles = Array.isArray(right.metadata.files) ? right.metadata.files : [];
        const overlaps = leftFiles.some((leftScope) =>
          rightFiles.some((rightScope) => scopesOverlap(leftScope, rightScope)),
        );
        if (overlaps) {
          errors.push(`第 ${batch} 批的 ${left.metadata.id} 与 ${right.metadata.id} 文件范围重叠，不能并行。`);
        }
      }
    }
    const memberIds = batchSteps.map((step) => step.metadata.id);
    const hasIntegration = steps.some(
      (step) =>
        step.metadata.kind === "integration" &&
        step.metadata.execution === "serial" &&
        step.metadata.gitAction === "merge-branches" &&
        step.metadata.branch === metadata?.repository?.integrationBranch &&
        step.metadata.batch > batch &&
        Array.isArray(step.metadata.dependsOn) &&
        memberIds.every((id) => step.metadata.dependsOn.includes(id)),
    );
    if (!hasIntegration) {
      errors.push(`第 ${batch} 批之后必须有一个等待全部并行步骤的串行 integration 步骤。`);
    }
  }

  for (const step of steps) {
    const meta = step.metadata;
    if (meta.execution === "serial" && meta.gitAction === "create-branch") {
      errors.push(`${meta.id} 是串行步骤，不应新建独立并行分支。`);
    }
    if (
      meta.push === "after-acceptance-with-approval" &&
      (step !== steps.at(-1) ||
        meta.execution !== "serial" ||
        meta.branch !== metadata?.repository?.integrationBranch)
    ) {
      errors.push(`${meta.id} 只有整合分支上的最后一个串行步骤可以在授权后推送。`);
    }
    if (metadata?.repository?.remoteProvider === "none" && meta.push !== "none") {
      errors.push(`${meta.id} 未连接远程仓库，不能安排推送。`);
    }
    if (meta.execution === "serial" && meta.branch !== metadata?.repository?.integrationBranch) {
      errors.push(`${meta.id} 的串行步骤必须使用 integrationBranch。`);
    }
  }
  if (
    metadata?.repository?.remoteProvider !== "none" &&
    steps.length > 0 &&
    steps.at(-1).metadata.push !== "after-acceptance-with-approval"
  ) {
    errors.push("已连接远程仓库时，最后一个串行步骤必须标明：最终验收并获得授权后才推送。");
  }

  if (metadata?.capability?.mode === "no-code" && metadata?.project?.hasFrontend && steps.length > 0) {
    const first = steps[0].metadata;
    if (first.kind !== "frontend" || first.evidence !== "ui") {
      errors.push("完全不看代码且有前端时，第一步必须是 frontend + ui。");
    }
  }

  const firstMockIndex = steps.findIndex((step) => step.metadata.data === "mock");
  if (firstMockIndex >= 0) {
    const hasRealUiIntegration = steps
      .slice(firstMockIndex + 1)
      .some((step) => step.metadata.kind === "integration" && step.metadata.evidence === "ui" && step.metadata.data === "real");
    if (!hasRealUiIntegration) errors.push("使用 mock/fixture 后，必须安排更后的真实 UI 集成步骤。");
  }

  return { valid: errors.length === 0, errors, steps };
}

export function mergeCompletedSteps(oldMarkdown, newMarkdown) {
  const oldSteps = parseSteps(oldMarkdown);
  const completed = oldSteps.filter((step) => step.metadata.status === "completed");
  if (completed.length === 0) return newMarkdown;

  const incoming = parseSteps(newMarkdown);
  const incomingById = new Map(incoming.map((step) => [step.metadata.id, step]));
  for (const step of completed) {
    if (!incomingById.has(step.metadata.id)) {
      throw new Error(`更新缺少已完成步骤 ${step.metadata.id}；请原样保留所有已完成步骤。`);
    }
  }

  let merged = newMarkdown;
  const replacements = completed
    .map((oldStep) => ({ oldStep, incoming: incomingById.get(oldStep.metadata.id) }))
    .sort((a, b) => b.incoming.start - a.incoming.start);
  for (const { oldStep, incoming: newStep } of replacements) {
    merged = merged.slice(0, newStep.start) + oldStep.raw + merged.slice(newStep.end);
  }
  return merged;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function ensureSafeDirectory(root, directory) {
  fs.mkdirSync(directory, { recursive: true });
  const realDirectory = fs.realpathSync(directory);
  if (!isInside(root, realDirectory)) throw new Error("目标目录指向项目外部，已拒绝写入。");
  return realDirectory;
}

export function resolveSafePaths(projectRoot) {
  const root = fs.realpathSync(path.resolve(projectRoot));
  const target = path.join(root, "IDIOTS_ROADMAP.md");
  if (!isInside(root, target)) throw new Error("Roadmap 路径越过项目根目录。");
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
    throw new Error("IDIOTS_ROADMAP.md 是符号链接，已拒绝写入。");
  }

  const control = path.join(root, ".idiotsroadmap");
  const archive = path.join(control, "archive");
  ensureSafeDirectory(root, archive);
  return { root, target, archive };
}

function slugGoal(goal) {
  const slug = String(goal)
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 60);
  return slug || "roadmap";
}

function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function nextArchivePath(archive, goal, now) {
  const base = `${timestamp(now)}-${slugGoal(goal)}`;
  let candidate = path.join(archive, `${base}.md`);
  let suffix = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(archive, `${base}-${suffix}.md`);
    suffix += 1;
  }
  return candidate;
}

function atomicWrite(target, content) {
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`,
  );
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
    try {
      fs.unlinkSync(temporary);
    } catch {
      // Rename succeeded or cleanup is best effort.
    }
  }
}

export function readExisting(target) {
  try {
    return fs.readFileSync(target, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function extractStoredGoal(markdown) {
  const match = markdown?.match(/<!--\s*IR_STORED_META\s+(\{[^\r\n]*\})\s*-->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]).goal || null;
  } catch {
    return null;
  }
}

export function withStoredMetadata(markdown, metadata) {
  const marker = `<!-- IR_STORED_META ${JSON.stringify({
    version: 1,
    goal: metadata.goal,
    capability: metadata.capability,
    language: metadata.language,
    project: metadata.project,
    repository: metadata.repository,
  })} -->`;
  return `${marker}\n${markdown.replace(/^<!--\s*IR_STORED_META[^\n]*-->\s*/u, "")}`;
}

export function persistRoadmap({ projectRoot, envelope, now = new Date() }) {
  const incomingValidation = validateRoadmap(envelope);
  if (!incomingValidation.valid) {
    throw new Error(incomingValidation.errors.join("\n"));
  }
  const paths = resolveSafePaths(projectRoot);
  const oldMarkdown = readExisting(paths.target);
  let markdown = envelope.markdown;

  if (oldMarkdown && envelope.metadata.action === "update") {
    const oldGoal = extractStoredGoal(oldMarkdown);
    if (oldGoal && oldGoal !== envelope.metadata.goal) {
      throw new Error("update 的 goal 与现有 Roadmap 不一致；新目标必须使用 action:new。");
    }
    markdown = mergeCompletedSteps(oldMarkdown, markdown);
    const mergedValidation = validateRoadmap({ ...envelope, markdown });
    if (!mergedValidation.valid) {
      throw new Error(`保留已完成步骤后 Roadmap 无效：\n${mergedValidation.errors.join("\n")}`);
    }
  }

  const stored = withStoredMetadata(markdown, envelope.metadata);
  if (oldMarkdown === stored) return { target: paths.target, archive: null, unchanged: true };

  let archivePath = null;
  if (oldMarkdown && envelope.metadata.action === "new") {
    archivePath = nextArchivePath(paths.archive, extractStoredGoal(oldMarkdown) || envelope.metadata.goal, now);
    fs.copyFileSync(paths.target, archivePath, fs.constants.COPYFILE_EXCL);
  }

  atomicWrite(paths.target, stored);
  return { target: paths.target, archive: archivePath, unchanged: false };
}
