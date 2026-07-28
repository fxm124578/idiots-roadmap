#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { writeAdditionalContext } from "./lib/host.mjs";
import { readHookInput } from "./lib/io.mjs";
import { detectLanguageGroups, hasFrontend } from "./lib/languages.mjs";
import { buildPlanProtocol } from "./lib/protocol.mjs";

const input = await readHookInput();
const permissionMode = input.permission_mode || input.permissionMode || input.hook_input?.permission_mode;

if (permissionMode !== "plan") process.exit(0);

try {
  const root = path.resolve(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const context = buildPlanProtocol({
    languageGroups: detectLanguageGroups(root),
    existingRoadmap: fs.existsSync(path.join(root, "IDIOTS_ROADMAP.md")),
    hasFrontend: hasFrontend(root),
  });
  writeAdditionalContext("UserPromptSubmit", context);
} catch {
  // Hooks must never prevent the host from accepting the user's prompt.
}
