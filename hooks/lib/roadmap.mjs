import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BEGIN = /<!--\s*IDIOTS_ROADMAP:BEGIN\s+(\{[^\r\n]*\})\s*-->/;
const END = /<!--\s*IDIOTS_ROADMAP:END\s*-->/;
const OPTOUT = /<!--\s*IDIOTS_ROADMAP:OPTOUT\s*-->/;
const STEP_START = /<!--\s*IR_STEP\s+(\{[^\r\n]*\})\s*-->/g;
const STEP_END = /<!--\s*IR_STEP_END\s*-->/g;
const REQUIRED_SECTIONS = ["goal", "capability", "progress", "usage", "steps"];
const REQUIRED_FIELDS = ["prompt", "boundaries", "acceptance", "checklist", "reply"];
const ALLOWED_STATUS = new Set(["pending", "in_progress", "awaiting_acceptance", "completed"]);
const ALLOWED_KIND = new Set(["frontend", "backend", "integration", "cli", "report", "migration", "infrastructure", "other"]);
const ALLOWED_EVIDENCE = new Set(["ui", "sample-io", "report", "code", "diff"]);
const ALLOWED_DATA = new Set(["none", "mock", "real"]);
const REQUIRED_GUARD = "<!-- IR_GUARD:current-step-only,run-checks,stop-for-acceptance -->";

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
  steps.forEach((step, index) => {
    const expectedId = `step-${String(index + 1).padStart(2, "0")}`;
    const meta = step.metadata;
    if (meta.id !== expectedId) errors.push(`第 ${index + 1} 步 ID 应为 ${expectedId}。`);
    if (ids.has(meta.id)) errors.push(`步骤 ID 重复：${meta.id}。`);
    ids.add(meta.id);
    if (!meta.label || typeof meta.label !== "string") errors.push(`${meta.id || expectedId} 缺少用户可见 label。`);
    if (labels.has(meta.label)) errors.push(`子步骤 label 重复：${meta.label}。`);
    labels.add(meta.label);
    if (!ALLOWED_STATUS.has(meta.status)) errors.push(`${meta.id || expectedId} 的 status 无效。`);
    if (!ALLOWED_KIND.has(meta.kind)) errors.push(`${meta.id || expectedId} 的 kind 无效。`);
    if (!ALLOWED_EVIDENCE.has(meta.evidence)) errors.push(`${meta.id || expectedId} 的 evidence 无效。`);
    if (!ALLOWED_DATA.has(meta.data)) errors.push(`${meta.id || expectedId} 的 data 无效。`);
    errors.push(...validateStepDisplayFormat(step, meta.id || expectedId));

    for (const field of REQUIRED_FIELDS) {
      if (!fieldContent(step, field)) errors.push(`${meta.id || expectedId} 缺少或留空 IR_FIELD:${field}。`);
    }
    const prompt = fieldContent(step, "prompt") || "";
    if (!prompt.includes(REQUIRED_GUARD)) errors.push(`${meta.id || expectedId} 的提示词缺少 IR_GUARD。`);
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
  })} -->`;
  return `${marker}\n${markdown.replace(/^<!--\s*IR_STORED_META[^\n]*-->\s*/u, "")}`;
}

export function persistRoadmap({ projectRoot, envelope, now = new Date() }) {
  const paths = resolveSafePaths(projectRoot);
  const oldMarkdown = readExisting(paths.target);
  let markdown = envelope.markdown;

  if (oldMarkdown && envelope.metadata.action === "update") {
    const oldGoal = extractStoredGoal(oldMarkdown);
    if (oldGoal && oldGoal !== envelope.metadata.goal) {
      throw new Error("update 的 goal 与现有 Roadmap 不一致；新目标必须使用 action:new。");
    }
    markdown = mergeCompletedSteps(oldMarkdown, markdown);
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
