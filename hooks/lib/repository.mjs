import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function runGit(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2_000,
      maxBuffer: 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
}

function isGitHubUrl(url) {
  return /(?:^|[/:@])github\.com(?:[/:]|$)/i.test(url || "");
}

export function detectRepositoryState(projectRoot) {
  const root = path.resolve(projectRoot);
  const gitMarker = fs.existsSync(path.join(root, ".git"));
  const inside = runGit(root, ["rev-parse", "--is-inside-work-tree"]);
  const isGitRepo = inside === "true" || (inside === null && gitMarker);

  if (!isGitRepo) {
    return {
      isGitRepo: false,
      workingTree: "unknown",
      currentBranch: null,
      remoteProvider: "none",
      remoteName: null,
    };
  }

  const status = runGit(root, ["status", "--porcelain", "--untracked-files=normal"]);
  const currentBranch =
    runGit(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]) ||
    runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const remoteNames = (runGit(root, ["remote"]) || "")
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
  const remotes = remoteNames.map((name) => ({
    name,
    url: runGit(root, ["remote", "get-url", name]) || "",
  }));
  const selected =
    remotes.find((remote) => remote.name === "origin" && isGitHubUrl(remote.url)) ||
    remotes.find((remote) => isGitHubUrl(remote.url)) ||
    remotes.find((remote) => remote.name === "origin") ||
    remotes[0] ||
    null;

  return {
    isGitRepo: true,
    workingTree: status === null ? "unknown" : status ? "dirty" : "clean",
    currentBranch: currentBranch && currentBranch !== "HEAD" ? currentBranch : null,
    remoteProvider: selected ? (isGitHubUrl(selected.url) ? "github" : "other") : "none",
    remoteName: selected?.name || null,
  };
}
