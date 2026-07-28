import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function statePath(root, sessionId) {
  const stateRoot = process.env.IDIOTS_ROADMAP_STATE_DIR || path.join(os.tmpdir(), "idiots-roadmap");
  const key = crypto.createHash("sha256").update(`${root}\0${sessionId || "unknown"}`).digest("hex");
  return path.join(stateRoot, `${key}.json`);
}

export function readFailures(root, sessionId) {
  try {
    return JSON.parse(fs.readFileSync(statePath(root, sessionId), "utf8")).failures || 0;
  } catch {
    return 0;
  }
}

export function recordFailure(root, sessionId) {
  const file = statePath(root, sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const failures = readFailures(root, sessionId) + 1;
  fs.writeFileSync(file, JSON.stringify({ failures, updatedAt: Date.now() }), "utf8");
  return failures;
}

export function clearFailures(root, sessionId) {
  try {
    fs.unlinkSync(statePath(root, sessionId));
  } catch {
    // Best effort. State contains no user capability data.
  }
}
