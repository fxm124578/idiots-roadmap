import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_FAILURE_TTL_MS = 30 * 60 * 1000;

function normalizeIdentity(identity) {
  if (!identity || typeof identity !== "object") {
    throw new TypeError("Failure identity is required.");
  }

  const normalized = {
    sessionId: String(identity.sessionId || "").trim(),
    goal: String(identity.goal || "").trim(),
    event: String(identity.event || "").trim(),
    revision: String(identity.revision || "").trim(),
  };
  if (Object.values(normalized).some((value) => !value)) {
    throw new TypeError("Failure identity requires sessionId, goal, event, and revision.");
  }
  return normalized;
}

function statePath(root, identity) {
  const stateRoot = process.env.IDIOTS_ROADMAP_STATE_DIR || path.join(os.tmpdir(), "idiots-roadmap");
  const scope = normalizeIdentity(identity);
  const key = crypto
    .createHash("sha256")
    .update(`${root}\0${scope.sessionId}\0${scope.goal}\0${scope.event}\0${scope.revision}`)
    .digest("hex");
  return path.join(stateRoot, `${key}.json`);
}

function ttlFromEnvironment() {
  const configured = Number(process.env.IDIOTS_ROADMAP_FAILURE_TTL_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_FAILURE_TTL_MS;
}

export function readFailures(root, identity, { now = Date.now() } = {}) {
  const file = statePath(root, identity);
  try {
    const state = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Number.isFinite(state.expiresAt) || state.expiresAt <= now) {
      try {
        fs.unlinkSync(file);
      } catch {
        // Expired state is treated as absent even if best-effort cleanup fails.
      }
      return 0;
    }
    return Number.isInteger(state.failures) && state.failures > 0 ? state.failures : 0;
  } catch {
    return 0;
  }
}

export function recordFailure(
  root,
  identity,
  { now = Date.now(), ttlMs = ttlFromEnvironment() } = {},
) {
  const scope = normalizeIdentity(identity);
  const file = statePath(root, scope);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const failures = readFailures(root, scope, { now }) + 1;
  const safeTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_FAILURE_TTL_MS;
  fs.writeFileSync(
    file,
    JSON.stringify({
      failures,
      updatedAt: now,
      expiresAt: now + safeTtl,
      identity: scope,
    }),
    "utf8",
  );
  return failures;
}

export function clearFailures(root, identity) {
  try {
    fs.unlinkSync(statePath(root, identity));
  } catch {
    // Best effort. State contains no user capability data.
  }
}
