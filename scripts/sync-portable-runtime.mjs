#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "skills", "idiots-roadmap", "scripts");
const engine = fs.readFileSync(path.join(root, "hooks", "lib", "project-state.mjs"), "utf8");
const runner = fs.readFileSync(path.join(root, "scripts", "roadmap-state.mjs"), "utf8").replace(
  'from "../hooks/lib/project-state.mjs";',
  'from "./project-state.mjs";',
);

fs.mkdirSync(target, { recursive: true });
fs.writeFileSync(path.join(target, "project-state.mjs"), engine, "utf8");
fs.writeFileSync(path.join(target, "roadmap-state.mjs"), runner, "utf8");
process.stdout.write("Portable Roadmap runtime is synchronized.\n");
