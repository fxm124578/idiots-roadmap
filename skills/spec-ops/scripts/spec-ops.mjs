import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const markdown = new Set([".md", ".markdown", ".mdx"]);
const source = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".go", ".java", ".rb", ".cs", ".vue", ".svelte"]);
const ignored = new Set([".git", "node_modules", ".product-trace", "coverage", "dist", "build"]);
const confidence = new Set(["verified", "observed", "inferred", "stale", "unknown"]);
const unitMarker = /^\s*<!--\s*unit:\s*([a-z0-9][a-z0-9.-]*)\s*-->\s*$/u;
const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/u;
const fence = /^\s*(?:```|~~~)/u;

const relative = (root, file) => path.relative(root, file).split(path.sep).join("/");
const readJson = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
function inside(root, candidate) {
  const resolved = path.resolve(candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("路径必须位于项目根目录内。");
  return resolved;
}
function files(target, extensions, skip = new Set()) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return extensions.has(path.extname(target).toLowerCase()) ? [path.resolve(target)] : [];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || skip.has(entry.name)) return [];
    const item = path.join(target, entry.name);
    return entry.isDirectory() ? files(item, extensions, skip) : extensions.has(path.extname(item).toLowerCase()) ? [item] : [];
  }).sort();
}
const markdownFiles = (target) => files(target, markdown);
const sourceFiles = (target) => files(target, source, ignored);
function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, file);
}
function atomicBatch(entries) {
  const prior = new Map(entries.map(([file]) => [file, fs.existsSync(file) ? fs.readFileSync(file) : null]));
  const staged = [];
  try {
    for (const [file, value] of entries) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(temporary, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, "utf8");
      staged.push([file, temporary]);
    }
    for (const [file, temporary] of staged) fs.renameSync(temporary, file);
  } catch (error) {
    for (const [file, temporary] of staged) {
      if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
      const old = prior.get(file);
      if (old === null) fs.rmSync(file, { force: true });
      else atomicWrite(file, old.toString("utf8"));
    }
    throw error;
  }
}

export function parseFile(file) {
  const lines = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  const units = []; const errors = []; let fenced = false;
  for (let markerLine = 0; markerLine < lines.length; markerLine += 1) {
    if (fence.test(lines[markerLine])) { fenced = !fenced; continue; }
    if (fenced) continue;
    const marker = lines[markerLine].match(unitMarker); if (!marker) continue;
    const offset = lines.slice(markerLine + 1).findIndex((line) => heading.test(line));
    if (offset < 0) { errors.push(`单元 ${marker[1]} 后缺少标题。`); continue; }
    const titleLine = markerLine + offset + 1; const title = lines[titleLine].match(heading); let endLine = lines.length;
    let innerFenced = false;
    for (let cursor = titleLine + 1; cursor < lines.length; cursor += 1) {
      if (fence.test(lines[cursor])) { innerFenced = !innerFenced; continue; }
      if (innerFenced) continue;
      const next = lines[cursor].match(heading);
      if (next && next[1].length <= title[1].length) { endLine = cursor; break; }
    }
    units.push({ id: marker[1], file: path.resolve(file), title: title[2], startLine: markerLine + 1, endLine, text: lines.slice(markerLine, endLine).join("\n") });
  }
  return { units, errors };
}
export function parseSpec(target) {
  const results = markdownFiles(target).map(parseFile); const units = results.flatMap((result) => result.units); const errors = results.flatMap((result) => result.errors); const seen = new Set();
  for (const unit of units) { if (seen.has(unit.id)) errors.push(`单元 ID ${unit.id} 重复。`); seen.add(unit.id); }
  return { files: results.length, units, errors };
}
export function selectUnits(parsed, lines) {
  if (!lines) return { units: [], message: "未提供选区，按文件或目录处理。" };
  const [start, end = start] = lines.split("-").map(Number);
  const units = parsed.units.filter((unit) => unit.startLine <= end && unit.endLine >= start);
  return { units, message: units.length === 1 ? `选区定位到 ${units[0].id}。` : units.length ? "选区跨多个设计单元。" : "选区未包含稳定设计单元。" };
}
export function diffSpec(specPath, projectRoot) {
  const root = path.resolve(projectRoot); const spec = inside(root, specPath);
  const current = parseSpec(spec); const changed = []; const snapshots = path.join(root, ".product-trace", "snapshots"); const previousUnits = new Map();
  if (fs.existsSync(snapshots)) for (const file of markdownFiles(snapshots)) for (const unit of parseFile(file).units) previousUnits.set(unit.id, unit);
  for (const unit of current.units) {
    const previous = previousUnits.get(unit.id);
    if (!previous || previous.text !== unit.text) changed.push({ id: unit.id, title: unit.title, kind: previous ? "changed" : "new" });
  }
  for (const [id, unit] of previousUnits) if (!current.units.some((item) => item.id === id)) changed.push({ id, title: unit.title, kind: "deleted" });
  return { changed, errors: current.errors, hasSnapshot: fs.existsSync(path.join(root, ".product-trace", "state.json")) };
}
export function buildIndex(specPath, projectRoot) {
  const root = path.resolve(projectRoot); const spec = inside(root, specPath); const parsed = parseSpec(spec); const candidates = sourceFiles(root); const units = {};
  for (const unit of parsed.units) {
    const terms = [...new Set(unit.title.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [])].slice(0, 8); const implementation = []; const tests = [];
    for (const file of candidates) {
      const matchedTerms = terms.filter((term) => fs.readFileSync(file, "utf8").toLowerCase().includes(term));
      if (!matchedTerms.length) continue;
      const item = { path: relative(root, file), role: relative(root, file).includes("test") ? "测试" : "候选实现", confidence: "inferred", matchedTerms };
      (item.role === "测试" ? tests : implementation).push(item);
    }
    units[unit.id] = { document: { file: relative(root, unit.file), anchor: unit.id, title: unit.title }, implementation, tests, dependsOn: [], usedBy: [] };
  }
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), specPath: relative(root, spec), units, errors: parsed.errors };
}
export function impact(unitId, projectRoot) {
  const index = readJson(path.join(projectRoot, ".product-trace", "index.json"), null);
  if (!index) throw new Error("尚未建立追溯地图，请先运行 index --write。");
  const unit = index.units[unitId]; if (!unit) throw new Error(`找不到设计单元：${unitId}`);
  const mapped = [...unit.implementation, ...unit.tests];
  return { unit: { id: unitId, ...unit.document }, willChange: mapped.filter((item) => ["verified", "observed"].includes(item.confidence)), willCheck: mapped.filter((item) => !["verified", "observed"].includes(item.confidence)), adjacentExperiences: [...unit.dependsOn, ...unit.usedBy], willNotChange: ["未被当前规则触及的其他产品行为"] };
}
export function sync(projectRoot, specPath, options = {}) {
  const root = path.resolve(projectRoot); const spec = inside(root, specPath); const trace = path.join(root, ".product-trace"); const index = options.index ?? buildIndex(spec, root);
  if (index.errors.length) throw new Error(index.errors.join("\n"));
  const previous = readJson(path.join(trace, "state.json"), {}); const syncedAt = new Date().toISOString();
  const state = { schemaVersion: 1, syncedAt, specPath: index.specPath, indexStatus: "current", units: Object.fromEntries(Object.keys(index.units).map((id) => [id, { status: options.status ?? previous.units?.[id]?.status ?? "待验证" }])) };
  const id = `${syncedAt.replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
  const change = { id, syncedAt, status: options.status ?? "待验证", summary: options.change ?? "同步策划案与追溯地图", units: Object.keys(index.units) };
  const base = fs.statSync(spec).isDirectory() ? spec : path.dirname(spec);
  const entries = [[path.join(trace, "index.json"), index], [path.join(trace, "state.json"), state], [path.join(trace, "changes", `${id}.json`), change]];
  for (const file of markdownFiles(spec)) entries.push([path.join(trace, "snapshots", relative(base, file)), fs.readFileSync(file, "utf8")]);
  atomicBatch(entries);
  return { state, change };
}
export function validate(projectRoot) {
  const root = path.resolve(projectRoot); const index = readJson(path.join(root, ".product-trace", "index.json"), null); const state = readJson(path.join(root, ".product-trace", "state.json"), null); const errors = [];
  if (!index || !state) return { valid: false, errors: ["缺少 index.json 或 state.json。"] };
  const parsed = parseSpec(inside(root, path.join(root, index.specPath))); errors.push(...parsed.errors); const ids = new Set(parsed.units.map((unit) => unit.id));
  for (const [id, unit] of Object.entries(index.units)) {
    if (!ids.has(id)) errors.push(`地图中的单元 ${id} 已不在策划案中。`);
    for (const item of [...unit.implementation, ...unit.tests]) {
      if (!confidence.has(item.confidence)) errors.push(`${id} 使用了未知可信度。`);
      if (!fs.existsSync(inside(root, path.join(root, item.path)))) errors.push(`${id} 映射到不存在的文件。`);
    }
  }
  for (const id of Object.keys(state.units)) if (!index.units[id]) errors.push(`状态中的单元 ${id} 不在地图中。`);
  return { valid: errors.length === 0, errors };
}
function cli() {
  const [command, ...args] = process.argv.slice(2); let result;
  if (command === "parse") { const [target, ...flags] = args; if (!target) throw new Error("用法：parse <策划案> [--lines 起止]"); const parsed = parseSpec(path.resolve(target)); const at = flags.indexOf("--lines"); result = { ...parsed, selection: selectUnits(parsed, at < 0 ? undefined : flags[at + 1]) }; if (parsed.errors.length) process.exitCode = 1; }
  else if (command === "diff") { result = diffSpec(args[0], args[1]); if (result.errors.length) process.exitCode = 1; }
  else if (command === "index") { const [spec, root, ...flags] = args; result = buildIndex(spec, root); if (flags.includes("--write")) atomicWrite(path.join(root, ".product-trace", "index.json"), result); if (result.errors.length) process.exitCode = 1; }
  else if (command === "impact") result = impact(args[0], args[1]);
  else if (command === "sync") { const [root, spec, ...flags] = args; const value = (flag) => { const at = flags.indexOf(flag); return at < 0 ? undefined : flags[at + 1]; }; result = sync(root, spec, { status: value("--status"), change: value("--change") }); }
  else if (command === "validate") { result = validate(args[0]); if (!result.valid) process.exitCode = 1; }
  else throw new Error("命令：parse、diff、index、impact、sync、validate");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) cli();
