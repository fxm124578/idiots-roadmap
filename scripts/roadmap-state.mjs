#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  approveCurrentBatch,
  claimCurrentWork,
  persistProjectState,
  renderRoadmap,
  validateProjectState,
} from "../hooks/lib/project-state.mjs";

function usage() {
  process.stderr.write(
    "Usage:\n" +
      "  node scripts/roadmap-state.mjs validate [project-root]\n" +
      "  node scripts/roadmap-state.mjs render [project-root]\n" +
      "  node scripts/roadmap-state.mjs approve [project-root]\n" +
      "  node scripts/roadmap-state.mjs claim [work-item-id] [project-root]\n" +
      "  node scripts/roadmap-state.mjs reclaim <work-item-id> [project-root]\n" +
      "  node scripts/roadmap-state.mjs bootstrap <candidate-state.json> [project-root]\n" +
      "  node scripts/roadmap-state.mjs apply <candidate-state.json> [project-root]\n",
  );
}

function resolveRoot(value) {
  return fs.realpathSync(path.resolve(value || process.cwd()));
}

function statePath(root) {
  return path.join(root, ".idiotsroadmap", "state.json");
}

function readState(file) {
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  const validation = validateProjectState(state);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  return state;
}

function atomicWrite(target, content) {
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.tmp`);
  fs.writeFileSync(temporary, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  try { fs.renameSync(temporary, target); }
  finally { try { fs.unlinkSync(temporary); } catch { /* renamed */ } }
}

function ensureCandidateInside(root, candidate) {
  const absolute = path.resolve(candidate);
  if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error("候选状态文件不能是符号链接。");
  const resolved = fs.realpathSync(absolute);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("候选状态文件必须位于项目目录内。");
  }
  return resolved;
}

const [command, first, second] = process.argv.slice(2);

try {
  if (command === "validate") {
    const root = resolveRoot(first);
    const state = readState(statePath(root));
    process.stdout.write(`V3 state revision ${state.revision} is valid.\n`);
  } else if (command === "render") {
    const root = resolveRoot(first);
    const state = readState(statePath(root));
    const target = path.join(root, "IDIOTS_ROADMAP.md");
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
      throw new Error("IDIOTS_ROADMAP.md 是符号链接，已拒绝写入。");
    }
    atomicWrite(target, renderRoadmap(state));
    process.stdout.write("IDIOTS_ROADMAP.md rendered from project state.\n");
  } else if (command === "approve") {
    const root = resolveRoot(first);
    const result = approveCurrentBatch(root);
    process.stdout.write(`${JSON.stringify({ action: "approved", revision: result.revision, proposalId: result.proposalId, unchanged: Boolean(result.unchanged) })}\n`);
  } else if (command === "claim") {
    const root = resolveRoot(second);
    const result = claimCurrentWork({ projectRoot: root, workItemId: first || null });
    process.stdout.write(`${JSON.stringify({ action: "claimed", revision: result.revision, workItemId: result.workItemId, title: result.title, claimId: result.claimId })}\n`);
  } else if (command === "reclaim") {
    if (!first) {
      usage();
      process.exitCode = 2;
    } else {
      const root = resolveRoot(second);
      const result = claimCurrentWork({ projectRoot: root, workItemId: first, reclaim: true });
      process.stdout.write(`${JSON.stringify({ action: "reclaimed", revision: result.revision, workItemId: result.workItemId, title: result.title, claimId: result.claimId })}\n`);
    }
  } else if (command === "apply") {
    if (!first) {
      usage();
      process.exitCode = 2;
    } else {
      const root = resolveRoot(second);
      const currentFile = statePath(root);
      const candidateFile = ensureCandidateInside(root, first);
      if (path.resolve(candidateFile) === path.resolve(currentFile)) {
        throw new Error("不能把当前 state.json 当作候选文件直接覆盖。");
      }
      const candidate = readState(candidateFile);
      let current = null;
      try { current = JSON.parse(fs.readFileSync(currentFile, "utf8")); } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const action =
        current?.schemaVersion === 3 && current.roadmapId === candidate.roadmapId
          ? "update"
          : current && [1, 2].includes(candidate.migration?.fromVersion)
            ? "update"
            : "new";
      const result = persistProjectState({
        projectRoot: root,
        metadata: {
          version: 3,
          action,
          roadmapId: candidate.roadmapId,
          revision: candidate.revision,
          baseRevision: candidate.baseRevision,
        },
        state: candidate,
      });
      fs.unlinkSync(candidateFile);
      process.stdout.write(`Applied revision ${result.revision}; current Session must now stop.\n`);
    }
  } else if (command === "bootstrap") {
    if (!first) {
      usage();
      process.exitCode = 2;
    } else {
      const root = resolveRoot(second);
      const currentFile = statePath(root);
      if (fs.existsSync(currentFile)) {
        throw new Error("项目已经存在 V3 Roadmap；首次初始化已拒绝，请使用项目内 runtime 的 apply 命令更新。");
      }
      const candidateFile = ensureCandidateInside(root, first);
      const candidate = readState(candidateFile);
      const result = persistProjectState({
        projectRoot: root,
        metadata: {
          version: 3,
          action: "new",
          roadmapId: candidate.roadmapId,
          revision: candidate.revision,
          baseRevision: candidate.baseRevision,
        },
        state: candidate,
      });
      fs.unlinkSync(candidateFile);
      process.stdout.write(`${JSON.stringify({ action: "bootstrapped", revision: result.revision, approval: candidate.current.approval.status, stop: true })}\n`);
    }
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
