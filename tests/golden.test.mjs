import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateRoadmap } from "../hooks/lib/roadmap.mjs";
import { makeEnvelope, makeStep } from "./helpers/roadmap-fixture.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(fs.readFileSync(path.join(directory, "golden", "cases.json"), "utf8"));

for (const scenario of cases) {
  test(`golden: ${scenario.name}`, () => {
    const steps = scenario.steps.map((step, index) =>
      makeStep({
        id: `step-${String(index + 1).padStart(2, "0")}`,
        ...step,
      }),
    );
    const envelope = makeEnvelope({ ...scenario, steps });
    const validation = validateRoadmap(envelope);
    assert.deepEqual(validation.errors, []);
  });
}

test("all no-code frontend golden cases start with visible frontend output", () => {
  const relevant = cases.filter((scenario) => scenario.capabilityMode === "no-code" && scenario.hasFrontend);
  for (const scenario of relevant) {
    assert.equal(scenario.steps[0].kind, "frontend", scenario.name);
    assert.equal(scenario.steps[0].evidence, "ui", scenario.name);
    assert.notEqual(scenario.steps[0].kind, "backend", scenario.name);
  }
});

test("golden mock UI cases disclose demo state and return to real UI verification", () => {
  const relevant = cases.filter((scenario) => scenario.steps.some((step) => step.data === "mock"));
  for (const scenario of relevant) {
    const mock = scenario.steps.find((step) => step.data === "mock");
    assert.match(`${mock.visible} ${mock.boundaries}`, /演示/);
    const later = scenario.steps.slice(scenario.steps.indexOf(mock) + 1);
    assert.ok(later.some((step) => step.kind === "integration" && step.evidence === "ui" && step.data === "real"));
  }
});
