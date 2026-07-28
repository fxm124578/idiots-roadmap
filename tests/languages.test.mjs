import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { detectLanguageGroups, hasFrontend } from "../hooks/lib/languages.mjs";

test("returns at most two repository language options ordered by evidence", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-languages-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "app.tsx"), "");
  fs.writeFileSync(path.join(root, "style.css"), "");
  fs.writeFileSync(path.join(root, "worker.py"), "");
  fs.writeFileSync(path.join(root, "main.go"), "");
  const groups = detectLanguageGroups(root);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].id, "frontend");
  assert.equal(hasFrontend(root), true);
});

test("ignores dependency directories and symlinks", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-languages-ignore-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "node_modules"));
  fs.writeFileSync(path.join(root, "node_modules", "fake.ts"), "");
  fs.writeFileSync(path.join(root, "main.py"), "");
  assert.deepEqual(detectLanguageGroups(root).map((group) => group.id), ["python"]);
});

test("detects a frontend even when it is not one of the top two language options", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "idiots-languages-front-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (let index = 0; index < 4; index += 1) fs.writeFileSync(path.join(root, `worker-${index}.py`), "");
  for (let index = 0; index < 3; index += 1) fs.writeFileSync(path.join(root, `service-${index}.go`), "");
  fs.writeFileSync(path.join(root, "page.tsx"), "");
  assert.deepEqual(detectLanguageGroups(root).map((group) => group.id), ["python", "go"]);
  assert.equal(hasFrontend(root), true);
});
