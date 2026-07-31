#!/usr/bin/env node
import path from "node:path";
import { allowWithMessage, blockStop, denyExitPlanMode } from "./lib/host.mjs";
import { readHookInput } from "./lib/io.mjs";
import { clearFailures, recordFailure } from "./lib/state.mjs";
import {
  findRoadmapPayload,
  parseEnvelope,
  persistRoadmap,
  validateRoadmap,
} from "./lib/roadmap.mjs";

const input = await readHookInput();
const eventName =
  process.argv.find((argument) => argument.startsWith("--event="))?.slice(8) ||
  input.hook_event_name;
const permissionMode = input.permission_mode || input.permissionMode || input.hook_input?.permission_mode;

if (permissionMode !== "plan") process.exit(0);
if (!["PreToolUse", "Stop"].includes(eventName)) process.exit(0);
if (
  eventName === "PreToolUse" &&
  (input.tool_name || input.toolName) !== "ExitPlanMode"
) {
  process.exit(0);
}

const root = path.resolve(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
const sessionId = input.session_id || input.sessionId || input.transcript_path;
if (typeof sessionId !== "string" || !sessionId.trim()) process.exit(0);

const text = findRoadmapPayload(input);

function readMetadataHint(value) {
  const marker = value?.match(/<!--\s*IDIOTS_ROADMAP:BEGIN\s+(\{[^\r\n]*\})\s*-->/);
  if (!marker) return {};
  try {
    return JSON.parse(marker[1]);
  } catch {
    return {};
  }
}

function failureIdentity(metadata = {}, value = "") {
  const headingGoal = value.match(/^#\s+Idiots Roadmap[：:]\s*(.+?)\s*$/m)?.[1];
  return {
    sessionId: sessionId.trim(),
    goal: String(metadata.goal || input.roadmap_goal || input.goal || headingGoal || "unidentified-goal"),
    event: eventName,
    revision: String(metadata.revision ?? metadata.baseRevision ?? metadata.version ?? "unidentified-revision"),
  };
}

if (!text) {
  if (eventName === "PreToolUse") {
    const identity = failureIdentity();
    recordFailure(root, identity);
    denyExitPlanMode(
      "没有找到可保存的 Idiots Roadmap，因此不能退出 Plan。请先生成完整 Roadmap，再次尝试结束计划。",
    );
  }
  process.exit(0);
}

let envelope;
let identity = failureIdentity(readMetadataHint(text), text);
try {
  envelope = parseEnvelope(text);
  if (envelope.type === "optout") {
    process.exit(0);
  }
  if (envelope.type !== "roadmap") process.exit(0);
  identity = failureIdentity(envelope.metadata, text);

  const validation = validateRoadmap(envelope);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));

  const result = persistRoadmap({ projectRoot: root, envelope });
  clearFailures(root, identity);
  const detail = result.unchanged ? "Roadmap 内容未变化。" : `Roadmap 已写入 ${result.target}。`;
  const archive = result.archive ? `旧 Roadmap 已归档到 ${result.archive}。` : "";
  const message = `${detail}${archive} Idiots Roadmap 到此停止；不要退出 Plan 或开始开发。`;

  if (eventName === "PreToolUse") denyExitPlanMode(message);
  else allowWithMessage(message);
} catch (error) {
  const failures = recordFailure(root, identity);
  if (eventName === "PreToolUse") {
    const reason =
      failures === 1
        ? `Idiots Roadmap 校验失败，因此不能退出 Plan。请只修正 Roadmap 标记块后再次尝试：\n${error.message}`
        : `Idiots Roadmap 再次校验失败，仍然不能退出 Plan。旧文件保持不变，请人工检查 Roadmap 后重试：\n${error.message}`;
    denyExitPlanMode(reason);
  } else if (failures === 1) {
    const reason = `Idiots Roadmap 校验失败，请只修正 Roadmap 标记块后再次结束回答，不要开始开发：\n${error.message}`;
    blockStop(reason);
  } else {
    const attemptLabel = failures === 2 ? "第二次" : `第 ${failures} 次`;
    allowWithMessage(
      `Idiots Roadmap ${attemptLabel}校验仍失败，已停止自动纠错；旧文件保持不变，当前仍停留在 Plan。请人工检查 Roadmap 后重试：${error.message}`,
    );
  }
}
