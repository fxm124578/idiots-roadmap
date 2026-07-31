import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { detectRepositoryState } from "../hooks/lib/repository.mjs";

function temporaryDirectory(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-roadmap-git-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function gitAvailable() {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

test("reports a directory without Git as uninitialized", (t) => {
  const root = temporaryDirectory(t);
  assert.deepEqual(detectRepositoryState(root), {
    isGitRepo: false,
    workingTree: "unknown",
    currentBranch: null,
    remoteProvider: "none",
    remoteName: null,
  });
});

test("detects dirty state and a GitHub remote without network access", (t) => {
  if (!gitAvailable()) {
    t.skip("Git is not available.");
    return;
  }
  const root = temporaryDirectory(t);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["remote", "add", "origin", "git@github.com:example/roadmap.git"], {
    cwd: root,
    stdio: "ignore",
  });
  fs.writeFileSync(path.join(root, "untracked.txt"), "user work", "utf8");

  const state = detectRepositoryState(root);
  assert.equal(state.isGitRepo, true);
  assert.equal(state.workingTree, "dirty");
  assert.equal(state.remoteProvider, "github");
  assert.equal(state.remoteName, "origin");
  assert.equal(typeof state.currentBranch, "string");
});
