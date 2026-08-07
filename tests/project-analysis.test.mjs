import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeExistingProject } from "../hooks/lib/project-analysis.mjs";

function temporaryProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-analysis-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("detects an empty directory as a new project", (t) => {
  const analysis = analyzeExistingProject(temporaryProject(t));
  assert.equal(analysis.origin, "new");
  assert.equal(analysis.scan.codeFileCount, 0);
});

test("summarizes an existing project using relative evidence only", (t) => {
  const root = temporaryProject(t);
  fs.mkdirSync(path.join(root, "src", "tasks"), { recursive: true });
  fs.mkdirSync(path.join(root, "tests"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), "{}", "utf8");
  fs.writeFileSync(path.join(root, "README.md"), "old plan", "utf8");
  fs.writeFileSync(path.join(root, "PLAN.md"), "new plan", "utf8");
  fs.writeFileSync(path.join(root, "src", "tasks", "routes.ts"), "export {};", "utf8");
  fs.writeFileSync(path.join(root, "tests", "tasks.test.ts"), "", "utf8");

  const analysis = analyzeExistingProject(root);
  assert.equal(analysis.origin, "existing");
  assert.equal(analysis.scan.testFileCount, 1);
  assert.ok(analysis.interfaceSignals.some((item) => item.kind === "route"));
  assert.ok(analysis.warnings.some((item) => /不能默认旧计划/.test(item)));
  assert.doesNotMatch(JSON.stringify(analysis), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
  assert.match(analysis.scan.fingerprint, /^[0-9a-f]{64}$/u);

  fs.appendFileSync(path.join(root, "src", "tasks", "routes.ts"), "\nexport const changed = true;", "utf8");
  assert.notEqual(analyzeExistingProject(root).scan.fingerprint, analysis.scan.fingerprint);
});

test("marks a bounded scan as incomplete instead of claiming full coverage", (t) => {
  const root = temporaryProject(t);
  for (let index = 0; index < 5; index += 1) fs.writeFileSync(path.join(root, `file-${index}.js`), "", "utf8");
  const analysis = analyzeExistingProject(root, { limit: 2 });
  assert.equal(analysis.scan.truncated, true);
  assert.ok(analysis.warnings.some((item) => /不能把当前摘要当作完整事实/.test(item)));
});
