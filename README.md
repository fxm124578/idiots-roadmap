# Idiots Roadmap

[中文说明](README.zh-CN.md) · [Project decisions](docs/decision-roadmap-workflow-retrospective.md) · [MIT license](LICENSE)

Idiots Roadmap is a set of Skills for handing a project from one AI session to the next. You approve the next result you want to see. The next session reads the current project state, takes an approved task, and records what was verified before proposing another batch.

The Roadmap keeps the goal, module boundaries, interfaces, and milestones stable while expanding only the current batch. `IDIOTS_ROADMAP.md` is the human-readable view. `.idiotsroadmap/state.json` stores approval, task ownership, dependencies, and evidence in the project that uses the Skills.

## Quick start

1. Install the Skills in [your host](#installation) and enter Plan mode in your product project.
2. Run `$idiots-roadmap` with your goal. Review the result card and approve the first batch when it describes what you want.
3. Open a new development session in the same product project and run `$idiots-roadmap-start`. It reads the approved result and claims one task.
4. Review the actual result. Run `$idiots-roadmap-finish` when the work is ready to close. Finish records the evidence, proposes the next batch, and stops.

Saving a plan and approving development are separate decisions. Changes to the approved outcome or its acceptance criteria require a new approval. The technical approach can adapt to the current code and evidence within the approved scope.

## Included Skills

| Skill | What it does |
| --- | --- |
| [`$idiots-roadmap`](skills/idiots-roadmap/SKILL.md) | Establishes a project baseline, milestones, and the first result card in Plan mode. |
| [`$idiots-roadmap-start`](skills/idiots-roadmap-start/SKILL.md) | Reads the latest approved batch, claims work, and prepares instructions for the current session. |
| [`$idiots-roadmap-finish`](skills/idiots-roadmap-finish/SKILL.md) | Verifies work, updates the project state, and proposes the next batch. |
| [`$idiots-roadmap-align`](skills/idiots-roadmap-align/SKILL.md) | Compares a live project with its plan and identifies changes that need a decision. |
| [`$spec-ops`](skills/spec-ops/SKILL.md) | Maps a referenced or edited Chinese Markdown specification to product behavior and verification evidence. It can be installed on its own. |

Git branches and worktrees support isolated development where the host allows it. A batch can use parallel sessions after shared interfaces and file ownership are clear. An integration session combines the accepted changes. Pushing remains a separate user decision.

## Installation

Node.js 18 or newer is required for the state tools and hooks. The project uses the Node.js standard library and has no third-party npm dependencies.

### Codex

```sh
codex plugin marketplace add https://github.com/fxm124578/idiots-roadmap.git
codex plugin add idiots-roadmap@idiots-roadmap
```

In Codex, use `/hooks` to review the local hooks before trusting them. The Skills can also save planning state through their bundled tools when hooks are unavailable and the host permits writing.

For **spec-ops only**, clone the repository and copy the entire `skills/spec-ops/` folder to `~/.codex/skills/spec-ops/`. Open a new session and run `$spec-ops` with the relevant specification.

### Claude Code

```text
/plugin marketplace add fxm124578/idiots-roadmap
/plugin install idiots-roadmap@idiots-roadmap
```

### Proma Pi

Import the directories under [`skills/`](skills/) into Workspace Skills and invoke `$idiots-roadmap` explicitly in Plan mode. Proma Pi uses the bundled state tools or saves the planning files after Plan mode, depending on host permissions.

The packaged workflow targets Codex, Claude Code, and Proma Pi. OpenCode and Hermes are outside the supported host set.

## Restore and verify on another device

```sh
git clone https://github.com/fxm124578/idiots-roadmap.git
cd idiots-roadmap
node scripts/validate-package.mjs
node --test
```

The repository includes the source, bundled Skills, manifests, tests, release tags, and a [workflow retrospective](docs/decision-roadmap-workflow-retrospective.md). A fresh clone needs no `npm install`. Reinstall the Skills in the host on the new device and repeat its local hook review if you use hooks.

A product's Roadmap files live in that product's working directory. Keep them with the product if you need to resume its approved tasks. Raw chat history is managed by the host.

## License

[MIT](LICENSE) © 2026 Idiots Roadmap Contributors.
