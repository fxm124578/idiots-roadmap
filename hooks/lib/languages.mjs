import fs from "node:fs";
import path from "node:path";

const GROUPS = [
  {
    id: "frontend",
    label: "JavaScript/TypeScript/CSS",
    extensions: new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".css", ".scss", ".sass", ".less", ".html", ".vue", ".svelte"]),
  },
  { id: "python", label: "Python", extensions: new Set([".py", ".pyi"]) },
  { id: "go", label: "Go", extensions: new Set([".go"]) },
  { id: "rust", label: "Rust", extensions: new Set([".rs"]) },
  { id: "jvm", label: "Java/Kotlin", extensions: new Set([".java", ".kt", ".kts"]) },
  { id: "dotnet", label: "C#/.NET", extensions: new Set([".cs", ".fs", ".fsx", ".vb"]) },
  { id: "cpp", label: "C/C++", extensions: new Set([".c", ".h", ".cc", ".cpp", ".cxx", ".hpp"]) },
  { id: "ruby", label: "Ruby", extensions: new Set([".rb"]) },
  { id: "php", label: "PHP", extensions: new Set([".php"]) },
  { id: "swift", label: "Swift", extensions: new Set([".swift"]) },
];

const IGNORED = new Set([
  ".git",
  ".hg",
  ".svn",
  ".idea",
  ".vscode",
  ".idiotsroadmap",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "coverage",
  "target",
  ".next",
  ".nuxt",
  ".venv",
  "venv",
  "__pycache__",
]);

export function detectLanguageGroups(root, limit = 2500, maxGroups = 2) {
  const counts = new Map(GROUPS.map((group) => [group.id, 0]));
  const stack = [root];
  let visited = 0;

  while (stack.length > 0 && visited < limit) {
    const directory = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (visited >= limit) break;
      visited += 1;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!IGNORED.has(entry.name)) stack.push(path.join(directory, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      for (const group of GROUPS) {
        if (group.extensions.has(extension)) {
          counts.set(group.id, counts.get(group.id) + 1);
          break;
        }
      }
    }
  }

  return GROUPS
    .map((group, index) => ({ id: group.id, label: group.label, count: counts.get(group.id), index }))
    .filter((group) => group.count > 0)
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, maxGroups)
    .map(({ id, label, count }) => ({ id, label, count }));
}

export function hasFrontend(root) {
  const groups = detectLanguageGroups(root, 2500, GROUPS.length);
  return groups.some((group) => group.id === "frontend");
}
