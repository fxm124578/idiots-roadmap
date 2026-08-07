import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const IGNORE = new Set([
  ".git",
  ".agents",
  ".claude",
  ".codex",
  ".idiotsroadmap",
  ".next",
  ".nuxt",
  ".venv",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor",
]);
const CODE_EXTENSIONS = new Set([
  ".c", ".cc", ".cpp", ".cs", ".css", ".go", ".html", ".java", ".js", ".jsx",
  ".kt", ".mjs", ".php", ".py", ".rb", ".rs", ".scss", ".swift", ".ts", ".tsx", ".vue",
]);
const TEST_PATTERN = /(?:^|\/)(?:test|tests|spec|specs|__tests__)(?:\/|$)|\.(?:test|spec)\.[^.]+$/iu;
const DOC_PATTERN = /(?:^|\/)(?:readme|agents|claude|context|roadmap|masterplan|plan|current|next|backlog)[^/]*\.(?:md|txt)$/iu;
const INTERFACE_PATTERNS = [
  ["route", /(?:^|[-_.\/])(route|router|routes)(?:[-_.\/]|$)/iu],
  ["api", /(?:^|[-_.\/])(api|controller|endpoint|handler)(?:[-_.\/]|$)/iu],
  ["schema", /(?:^|[-_.\/])(schema|migration|model|entity)(?:[-_.\/]|$)/iu],
  ["type", /(?:^|[-_.\/])(type|types|interface|dto)(?:[-_.\/]|$)/iu],
  ["event", /(?:^|[-_.\/])(event|events|message|queue)(?:[-_.\/]|$)/iu],
  ["config", /(?:^|[-_.\/])(config|settings|env)(?:[-_.\/]|$)/iu],
];
const MANIFESTS = new Set([
  "package.json", "pyproject.toml", "requirements.txt", "cargo.toml", "go.mod", "pom.xml",
  "build.gradle", "composer.json", "gemfile", "pubspec.yaml", "deno.json", "docker-compose.yml",
]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function walk(root, limit) {
  const files = [];
  const queue = [root];
  let truncated = false;
  while (queue.length > 0) {
    const directory = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (IGNORE.has(entry.name.toLowerCase()) || entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) queue.push(absolute);
      else if (entry.isFile()) {
        files.push(toPosix(path.relative(root, absolute)));
        if (files.length >= limit) {
          truncated = true;
          return { files, truncated };
        }
      }
    }
  }
  return { files, truncated };
}

function topLevel(relative) {
  const [first] = relative.split("/");
  return relative.includes("/") ? first : ".";
}

function summarizeModules(codeFiles) {
  const counts = new Map();
  for (const file of codeFiles) counts.set(topLevel(file), (counts.get(topLevel(file)) || 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 12)
    .map(([area, fileCount]) => ({ area, fileCount, confidence: "observed" }));
}

function summarizeInterfaces(files) {
  const signals = [];
  for (const [kind, pattern] of INTERFACE_PATTERNS) {
    const matches = files.filter((file) => pattern.test(file)).slice(0, 20);
    if (matches.length > 0) signals.push({ kind, files: matches, confidence: "observed" });
  }
  return signals;
}

function fingerprint(root, files) {
  const hash = crypto.createHash("sha256");
  for (const relative of [...files].sort()) {
    try {
      const stat = fs.statSync(path.join(root, ...relative.split("/")));
      hash.update(`${relative}\0${stat.size}\0${Math.trunc(stat.mtimeMs)}\n`);
    } catch {
      hash.update(`${relative}\0unknown\n`);
    }
  }
  return hash.digest("hex");
}

export function analyzeExistingProject(root, { limit = 5000 } = {}) {
  const resolved = path.resolve(root);
  const { files, truncated } = walk(resolved, limit);
  const codeFiles = files.filter((file) => CODE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const manifests = files.filter((file) => MANIFESTS.has(path.basename(file).toLowerCase()));
  const docs = files.filter((file) => DOC_PATTERN.test(file)).slice(0, 40);
  const tests = files.filter((file) => TEST_PATTERN.test(file));
  const existing = codeFiles.length > 0 || manifests.length > 0 || fs.existsSync(path.join(resolved, ".git"));
  const interfaceSignals = summarizeInterfaces(files);
  const conflictsLikely = docs.length > 1 && codeFiles.length > 0;

  return {
    origin: existing ? "existing" : "new",
    scan: {
      fileCount: files.length,
      codeFileCount: codeFiles.length,
      testFileCount: tests.length,
      truncated,
      fingerprint: fingerprint(resolved, files),
    },
    manifests: manifests.slice(0, 20),
    planningDocuments: docs,
    areaSignals: summarizeModules(codeFiles),
    interfaceSignals,
    evidencePolicy: {
      runtimeOrTests: "verified",
      codeAndStructure: "observed",
      documents: "declared",
      disagreement: "conflict",
      insufficientEvidence: "unknown",
    },
    warnings: [
      ...(truncated ? ["仓库文件较多；必须按模块继续分段分析，不能把当前摘要当作完整事实。"] : []),
      ...(conflictsLikely ? ["检测到代码和多份规划文档；必须比较证据，不能默认旧计划仍然有效。"] : []),
      ...(tests.length === 0 && codeFiles.length > 0 ? ["未检测到明显测试；代码存在不代表行为已经验证。"] : []),
    ],
  };
}
