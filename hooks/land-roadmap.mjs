#!/usr/bin/env node
import path from "node:path";
import { allowWithMessage, blockStop, denyExitPlanMode } from "./lib/host.mjs";
import { readHookInput } from "./lib/io.mjs";
import { clearFailures, readFailures, recordFailure } from "./lib/state.mjs";
import {
  findRoadmapPayload,
  parseEnvelope,
  persistRoadmap,
  validateRoadmap,
} from "./lib/roadmap.mjs";

const input = await readHookInput();
const eventName = process.argv.find((argument) => argument.startsWith("--event="))?.slice(8) || input.hook_event_name || "Stop";
const permissionMode = input.permission_mode || input.permissionMode || input.hook_input?.permission_mode;

if (permissionMode && permissionMode !== "plan") process.exit(0);

const root = path.resolve(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
const sessionId = input.session_id || input.sessionId || input.transcript_path || "unknown";
const text = findRoadmapPayload(input);

if (!text) process.exit(0);

let envelope;
try {
  envelope = parseEnvelope(text);
  if (envelope.type === "optout") {
    clearFailures(root, sessionId);
    process.exit(0);
  }
  if (envelope.type !== "roadmap") process.exit(0);

  const validation = validateRoadmap(envelope);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));

  const result = persistRoadmap({ projectRoot: root, envelope });
  clearFailures(root, sessionId);
  const detail = result.unchanged ? "Roadmap 内容未变化。" : `Roadmap 已写入 ${result.target}。`;
  const archive = result.archive ? `旧 Roadmap 已归档到 ${result.archive}。` : "";
  const message = `${detail}${archive} Idiots Roadmap 到此停止；不要退出 Plan 或开始开发。`;

  if (eventName === "PreToolUse") denyExitPlanMode(message);
  else allowWithMessage(message);
} catch (error) {
  const previousFailures = readFailures(root, sessionId);
  if (previousFailures < 1) {
    recordFailure(root, sessionId);
    const reason = `Idiots Roadmap 校验失败，请只修正 Roadmap 标记块后再次结束回答，不要开始开发：\n${error.message}`;
    if (eventName === "PreToolUse") denyExitPlanMode(reason);
    else blockStop(reason);
  } else {
    clearFailures(root, sessionId);
    allowWithMessage(`Idiots Roadmap 第二次校验仍失败，旧文件保持不变：${error.message}`);
  }
}
