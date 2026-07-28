import { writeJson } from "./io.mjs";

export function isCodex() {
  return Boolean(process.env.PLUGIN_DATA || process.env.CODEX_THREAD_ID);
}

export function writeAdditionalContext(eventName, context) {
  if (isCodex()) {
    writeJson({
      hookSpecificOutput: {
        hookEventName: eventName,
        additionalContext: context,
      },
    });
    return;
  }

  // Claude Code accepts plain stdout as context for UserPromptSubmit.
  process.stdout.write(context);
}

export function blockStop(reason) {
  writeJson({
    decision: "block",
    reason,
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: reason,
    },
  });
}

export function denyExitPlanMode(reason) {
  writeJson({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
      additionalContext: reason,
    },
  });
}

export function allowWithMessage(message = "") {
  writeJson(message ? { systemMessage: message } : {});
}
