import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildIndex, diffSpec, impact, parseSpec, selectUnits, sync, validate } from "../skills/spec-ops/scripts/spec-ops.mjs";

function project(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-ops-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "产品策划案")); fs.mkdirSync(path.join(root, "src")); fs.mkdirSync(path.join(root, "tests"));
  fs.writeFileSync(path.join(root, "产品策划案", "账户.md"), "<!-- unit: account.login.redirect -->\n## 登录返回\n\n### 规则\n登录后返回原页面。\n", "utf8");
  fs.writeFileSync(path.join(root, "src", "login.ts"), "export const 登录返回 = true;", "utf8");
  fs.writeFileSync(path.join(root, "tests", "login.test.mjs"), "// 登录返回", "utf8");
  return root;
}
test("stable ID survives title edits and selection locates its unit", (t) => {
  const root = project(t); const spec = path.join(root, "产品策划案", "账户.md"); const parsed = parseSpec(spec);
  assert.equal(parsed.errors.length, 0); assert.equal(selectUnits(parsed, "2-4").units[0].id, "account.login.redirect");
  fs.writeFileSync(spec, fs.readFileSync(spec, "utf8").replace("登录返回", "重新登录后回到来源页面"), "utf8");
  assert.equal(parseSpec(spec).units[0].id, "account.login.redirect");
});
test("parser ignores unit examples inside fenced code", (t) => {
  const root = project(t); const spec = path.join(root, "产品策划案", "示例.md");
  fs.writeFileSync(spec, "```md\n<!-- unit: sample.only -->\n## 示例\n```\n", "utf8");
  assert.equal(parseSpec(spec).units.length, 0);
});
test("index candidates stay inferred and impact does not silently change them", (t) => {
  const root = project(t); const index = buildIndex(path.join(root, "产品策划案"), root);
  assert.equal(index.units["account.login.redirect"].implementation[0].confidence, "inferred");
  fs.mkdirSync(path.join(root, ".product-trace")); fs.writeFileSync(path.join(root, ".product-trace", "index.json"), JSON.stringify(index));
  const card = impact("account.login.redirect", root); assert.equal(card.willChange.length, 0); assert.ok(card.willCheck.length > 0);
});
test("sync creates trace state, snapshots and a valid change record", (t) => {
  const root = project(t); const result = sync(root, path.join(root, "产品策划案"), { status: "已实现待验证", change: "补充登录返回" });
  assert.equal(result.state.units["account.login.redirect"].status, "已实现待验证"); assert.equal(validate(root).valid, true);
  assert.equal(fs.readdirSync(path.join(root, ".product-trace", "changes")).length, 1);
});
test("a changed rule is detected before the next product change is synced", (t) => {
  const root = project(t); const specs = path.join(root, "产品策划案"); const spec = path.join(specs, "账户.md"); sync(root, specs);
  fs.writeFileSync(spec, fs.readFileSync(spec, "utf8").replace("登录后返回原页面", "登录后返回来源页面并显示提示"), "utf8");
  assert.deepEqual(diffSpec(specs, root).changed, [{ id: "account.login.redirect", title: "登录返回", kind: "changed" }]);
});
test("a deleted unit is reported as a product change instead of being silently synced", (t) => {
  const root = project(t); const specs = path.join(root, "产品策划案"); const spec = path.join(specs, "账户.md"); sync(root, specs);
  fs.writeFileSync(spec, "## 账户\n", "utf8");
  assert.deepEqual(diffSpec(specs, root).changed, [{ id: "account.login.redirect", title: "登录返回", kind: "deleted" }]);
});
test("validation detects a missing stable ID instead of guessing", (t) => {
  const root = project(t); const spec = path.join(root, "产品策划案", "账户.md"); sync(root, path.join(root, "产品策划案"));
  fs.writeFileSync(spec, fs.readFileSync(spec, "utf8").replace("<!-- unit: account.login.redirect -->\n", ""), "utf8");
  const result = validate(root); assert.equal(result.valid, false); assert.match(result.errors.join("\n"), /已不在策划案/);
});
test("invalid specs leave no partial trace state", (t) => {
  const root = project(t); const spec = path.join(root, "产品策划案", "账户.md");
  fs.appendFileSync(spec, "\n<!-- unit: broken.unit -->\n");
  assert.throws(() => sync(root, path.join(root, "产品策划案")), /缺少标题/);
  assert.equal(fs.existsSync(path.join(root, ".product-trace")), false);
});
