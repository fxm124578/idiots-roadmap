# Roadmap 输出协议

## 目录

- 最终标记
- Roadmap 正文
- 步骤元数据
- V2 修复契约
- 完整示例

## 最终标记

跳过时只在最终计划末尾输出：

```html
<!-- IDIOTS_ROADMAP:OPTOUT -->
```

启用时输出：

```html
<!-- IDIOTS_ROADMAP:BEGIN {"version":1,"action":"new","capability":{"mode":"no-code","description":"完全不看代码"},"goal":"让用户能创建并查看任务","language":"zh-CN","project":{"hasFrontend":true},"repository":{"isGitRepo":true,"workingTree":"clean","currentBranch":"main","remoteProvider":"github","remoteName":"origin","integrationBranch":"ir/task-list","pushPolicy":"manual-after-final-acceptance"}} -->
...完整 Roadmap Markdown...
<!-- IDIOTS_ROADMAP:END -->
```

约束：

- `action` 只能是 `new` 或 `update`。
- `capability.mode` 使用 `no-code`、`code-reader` 或 `custom`。
- `capability.description` 原样记录用户选择或自定义描述。
- `goal` 用一句稳定、具体的话描述目标；同一 Roadmap 更新时不要改写。
- `project.hasFrontend` 必须是布尔值。
- `repository.isGitRepo` 是当前是否已有本地 Git 仓库。
- `repository.workingTree` 使用 `clean`、`dirty` 或 `unknown`。
- `repository.currentBranch` 是只读检测到的当前分支；未初始化或 detached/无法识别时使用 `null`。
- `repository.remoteProvider` 使用 `github`、`other` 或 `none`；`remoteName` 只记录 remote 名称，不保存带凭据的 URL。
- `repository.integrationBranch` 是本 Roadmap 的稳定整合分支。
- `repository.pushPolicy` 固定为 `manual-after-final-acceptance`。
- JSON 必须在一行内，使用合法双引号。

## Roadmap 正文

使用以下稳定标记。标记之间必须有用户可见的标题和内容，标题语言可随会话变化。

````markdown
# Idiots Roadmap：目标名称

<!-- IR_SECTION:goal -->
## 目标
...

<!-- IR_SECTION:capability -->
## 能力范围
...

<!-- IR_SECTION:progress -->
## 进度
...

<!-- IR_SECTION:usage -->
## 使用方法
...

<!-- IR_SECTION:git -->
## Git 状态
- 本地 Git：已启用
- 工作区：clean
- 当前分支：main
- GitHub：已连接（origin）
- 整合分支：ir/task-list
- 提交时机：每个步骤验收通过后
- 推送时机：整合验收通过且用户明确同意后

<!-- IR_SECTION:sessions -->
## Session 安排
- 第 1 批（串行）：子步骤 1
- 第 2 批（可同时开启多个 Session）：子步骤 2A、子步骤 2B
- 第 3 批（串行整合）：子步骤 3

<!-- IR_SECTION:steps -->
## 开发步骤
...
````

使用方法应告诉用户：按批次开启开发 Session；同一并行批次可同时复制各自提示词；开发 AI 停止后按验收条目检查；其依赖全部通过后再进入下一批。

## 步骤元数据

每步必须完整使用以下结构：

````markdown
<!-- IR_STEP {"id":"step-02","label":"2A","status":"pending","kind":"frontend","evidence":"ui","data":"mock","batch":2,"execution":"parallel","dependsOn":["step-01"],"files":["web/task-list/**"],"gitAction":"create-branch","branch":"ir/task-list/step-02","push":"none"} -->
**🧩 子步骤 2A：可理解的结果名称**

<!-- IR_FIELD:session -->
🔀 并行 Session｜第 2 批｜可与：子步骤 2B｜等待：子步骤 1｜文件范围：web/task-list/**

<!-- IR_FIELD:git -->
🌿 Git｜新建独立分支/worktree：ir/task-list/step-02｜验收通过后提交｜本步不推送

<!-- IR_FIELD:prompt -->
📋 第 1 步 — 复制以下提示词发给开发 AI：

```text
请只实现当前子步骤。

🎯 要求：
- 交付一个用户能直接验收的具体结果。
- 只修改这些文件或目录：web/task-list/**。
- 若需要改动范围外文件或发现与其他 Session 冲突，立即停止并说明。
- 从已通过的整合基线新建 ir/task-list/step-02；宿主支持独立 worktree 时优先使用。
- 多个 Session 共享目录时不要切换分支、暂存或提交，由整合 Session 统一收口。
- 保留用户已有改动，不得擅自 stash、覆盖或清理。
- 开发完成后先停止；收到“2A 通过，请继续。”后才提交当前文件范围。
- 本步骤禁止推送远程。
- ...

⚠️ 约束：...

<!-- IR_GUARD:current-step-only,run-checks,stop-for-acceptance -->
<!-- IR_SESSION_GUARD:file-scope,no-cross-session-edits,stop-on-conflict -->
<!-- IR_GIT_GUARD:commit-after-acceptance,no-auto-push,preserve-user-changes -->

【🚧 边界条件】
<!-- IR_FIELD:boundaries -->
- ...

【✅ 验收标准】
<!-- IR_FIELD:acceptance -->
- ...
- ...
```

<!-- IR_FIELD:checklist -->
☑️ 第 2 步 — 人工验收清单（2 项）：
- [ ] ...
- [ ] ...

<!-- IR_FIELD:reply -->
💬 第 3 步 — 回复：`2A 通过，请继续。`

<!-- IR_STEP_END -->
````

字段规则：

- 用户可见格式固定使用 `🧩`、`📋`、`🎯`、`⚠️`、`🚧`、`✅`、`☑️`、`💬` 八个标题图标。
- 实现要求、约束、边界条件和验收标准全部放在第 1 步的单个代码块中。
- 第 2 步必须把代码块内相同的 1–2 项验收标准改成 `- [ ]` 清单，文字和顺序都不得变化。
- 第 3 步必须给出精确通过口令：`<label> 通过，请继续。`
- ID 从 `step-01` 连续编号，不重复。
- `label` 是用户可见的子步骤编号，可使用 `1`、`4-3b` 等计划编号；同一 Roadmap 内不得重复。
- `status` 只能是 `pending`、`in_progress`、`awaiting_acceptance` 或 `completed`。
- `kind` 使用 `frontend`、`backend`、`integration`、`cli`、`report`、`migration`、`infrastructure` 或 `other`。
- `evidence` 使用 `ui`、`sample-io`、`report`、`code` 或 `diff`。
- `data` 使用 `none`、`mock` 或 `real`。
- `batch` 是从 1 开始的正整数，按 Roadmap 顺序只能递增或保持不变。
- `execution` 使用 `serial` 或 `parallel`。同一批只有一个步骤时必须为 `serial`；同一批有多个步骤时必须全部为 `parallel`，且最多 3 个。
- `dependsOn` 是更早批次中已存在步骤 ID 的数组；依赖步骤全部通过后，当前步骤才能开始。
- `files` 是当前 Session 唯一允许修改的项目相对路径或目录范围；不得使用绝对路径、`..` 或反斜杠。
- `gitAction` 使用 `stay`、`create-integration-branch`、`create-branch`、`merge-branches`、`initialize` 或 `prepare-baseline`。
- `branch` 是当前步骤的目标分支。并行步骤必须使用唯一子分支；串行与整合步骤使用 `repository.integrationBranch`。
- `push` 使用 `none` 或 `after-acceptance-with-approval`。并行步骤只能为 `none`；只有存在远程仓库、位于整合分支的最后一个串行步骤可以在最终验收和再次授权后推送。
- 同一并行批次的 `files` 不得重叠。无法明确划分文件范围时必须改为串行。
- 每个并行批次后必须有一个更晚的串行 `kind:"integration"`、`gitAction:"merge-branches"` 步骤，其 `dependsOn` 包含该批全部步骤。
- `IR_FIELD:session` 必须与元数据一致：串行使用 `➡️`，并行使用 `🔀`，并显示批次、等待步骤和文件范围。
- `IR_FIELD:git` 必须显示本步 Git 动作、目标分支、验收后提交和推送策略。
- 开发提示词必须包含完整的 `IR_GUARD`，并用自然语言说明具体实现范围、技术检查和停止条件。
- 开发提示词必须包含完整的 `IR_SESSION_GUARD`，并说明文件范围、冲突时停止，以及 worktree/共享目录边界；共享目录中的并行 Session 不得切换分支、暂存或提交。
- 开发提示词必须包含完整的 `IR_GIT_GUARD`；验收前不提交、没有再次授权不推送，并保留用户已有改动。
- 串行整合步骤必须先确认所有依赖已通过；共享目录直接联调，独立 worktree 合并已确认提交；只处理冲突、联调和回归。
- 当前不是 Git 仓库时，第一步使用 `gitAction:"initialize"`；工作区为 `dirty`、`unknown` 或 detached 时，第一步使用 `prepare-baseline`；干净但当前不在整合分支时，第一步使用 `create-integration-branch`。
- 用户验收使用 Markdown 列表，必须有 1–2 项。
- 无代码模式不得使用 `code` 或 `diff` 作为 evidence。
- 无代码且有前端时，第一步必须为 `kind:"frontend"`、`evidence:"ui"`。
- 如果任一步使用 `data:"mock"`，必须有更后的 `kind:"integration"`、`evidence:"ui"`、`data:"real"` 步骤。
- 演示数据和未实现的高风险能力必须在“要求”和“边界条件”中明确标注。

## V2 修复契约

本节是下一版实现的共同契约。V2 实现完成前，现有 V1 格式继续生效；不得让半完成的 V2 写入覆盖有效的 V1 Roadmap。

### 用户验收入口

- `capability.mode:"no-code"` 时，每份 `docs/verification/*.md` 和其他用户验收文件都必须先提供“30 秒看懂”。
- 入口只回答四件事：本步改了什么、用户只看哪里、看到什么算通过、哪些技术内容可以不看。
- 入口不得要求用户查看代码、diff、终端、日志、测试报告、分支或提交记录。
- 完整技术证据可放在同一文件后半部分，供开发 AI 和维护者追溯。

### Roadmap 身份与 revision

V2 BEGIN metadata 增加：

```json
{
  "version": 2,
  "roadmapId": "rm_<uuid>",
  "revision": 4,
  "baseRevision": 3
}
```

- `roadmapId` 在新目标创建时生成，此后不变。
- 新 Roadmap 使用 `revision:1`、`baseRevision:null`。
- 更新必须以当前 revision 作为 `baseRevision`，并使用 `revision = baseRevision + 1`。
- hook 落盘前重新读取项目状态；`baseRevision` 与当前 revision 不一致时拒绝覆盖，并提示用户重新生成。
- 同一 revision 只能成功落盘一次。
- 项目内 `.idiotsroadmap/state.json` 保存 `roadmapId`、当前 revision、最后成功落盘内容哈希和步骤状态摘要；不保存全局用户能力。
- Roadmap 文件在开发阶段发生变化时，只允许步骤状态向前推进以及对应进度文字更新；其他变化进入恢复模式，不自动覆盖。

### 稳定步骤 ID

- 步骤 `id` 是稳定身份，不再根据数组位置重新计算。
- V1 已存在的 `step-01` 等 ID 原样保留并从迁移完成后视为稳定 ID。
- 新步骤使用当前 Roadmap 从未使用过的新 ID；删除后不得复用。
- `label` 只负责用户可见编号，可使用 `1`、`1A`、`3B` 等形式调整阅读顺序。
- 更新时可以插入、删除或重排未完成步骤，但已完成步骤的原文、ID、label、能力范围和验收结果保持不变。

### 能力切换

- 每步增加 `createdUnderCapability`，记录生成该步骤时的能力模式和允许语言。
- 当前 Roadmap 能力只校验未完成步骤。
- 已完成步骤继续按 `createdUnderCapability` 解释，不因用户切换到新能力而重新校验或改写。
- 能力切换只重写 `pending`、`in_progress` 和 `awaiting_acceptance` 步骤。
- `completed` 不得回退；缺少或改写已完成步骤时拒绝更新。

### V1 迁移

- V1 文件保持可读取。
- 首次 V2 更新时，从现有文件生成 `roadmapId`、`revision:1` 和步骤状态摘要。
- V1 步骤 ID、已完成步骤原文和用户可见 label 原样保留。
- 迁移和新版本落盘使用同一次原子替换；任一校验失败时不创建半完成状态。
- 迁移失败时保留 V1 文件，显示可执行的恢复提示，不归档为新目标。

### Plan 失败状态

- `permission_mode` 必须明确等于 `plan`；缺失、未知或其他模式时完全静默。
- `PreToolUse/ExitPlanMode` 的 Roadmap 校验失败始终返回 deny，包括第二次及之后的失败。
- `Stop` 第一次失败阻止结束并要求修正一次；第二次失败允许本轮结束纠错，但必须明确 Roadmap 未落盘、旧文件未变化，且不得触发退出 Plan。
- 失败计数使用 `sessionId + goalHash + event + baseRevision` 作为身份，默认 30 分钟过期。
- 缺少稳定 Session ID 时不启用自动纠错计数，只返回安全提示。

### Workspace strategy

V2 repository metadata 增加：

```json
{
  "workspaceStrategy": "codex-managed-worktree",
  "baseCommit": "<accepted commit>",
  "integrationBranch": "ir/example"
}
```

`workspaceStrategy` 只能是：

- `codex-managed-worktree`：用户在 Codex 创建新 Worktree 任务；宿主负责目录隔离。开发 AI 先确认当前任务基于 `baseCommit`，正常 detached 状态不当作 dirty 错误。
- `claude-managed-worktree`：通过 Claude Code CLI、Desktop 或隔离 Session 创建 Worktree；开始前确认 base ref 对应 `baseCommit`。
- `manual-worktree`：开发 AI 创建独立 Worktree 和分支，用户不执行 Git 命令；创建失败时停止，不退化为共享目录切分支。
- `shared-directory`：多个 Session 共用项目目录；并行阶段不切分支、不暂存、不提交，只修改互不重叠文件，由整合 Session 统一检查和提交。

共同规则：

- 并行批次开始前必须有已经通过用户验收的 `baseCommit`。
- 每个并行步骤记录 strategy、允许文件范围和共同基线。
- 独立 Worktree 分支只有用户验收通过后才能提交；共享目录并行步骤不提交。
- 并行批次后的下一批必须是唯一串行整合批次，并依赖该批全部步骤。
- 整合完成后按 strategy 清理临时 Worktree 和分支；清理不得使用破坏用户数据的命令。
- V1 不实现 OpenCode；未来使用独立适配器，不复用当前 hooks 假装兼容。

### 本轮实现边界

- 本契约只覆盖 Plan 安全、Roadmap 更新状态和多 Session 工作方式。
- 路径安全、安装发布和 OpenCode 实现保留在审计后续计划中，不得混入本轮并行开发。

## 完整示例

````html
<!-- IDIOTS_ROADMAP:BEGIN {"version":1,"action":"new","capability":{"mode":"no-code","description":"完全不看代码"},"goal":"让用户能查看任务列表","language":"zh-CN","project":{"hasFrontend":true},"repository":{"isGitRepo":true,"workingTree":"clean","currentBranch":"main","remoteProvider":"none","remoteName":null,"integrationBranch":"ir/task-list","pushPolicy":"manual-after-final-acceptance"}} -->
# Idiots Roadmap：查看任务列表

<!-- IR_SECTION:goal -->
## 目标
打开页面即可查看任务列表。

<!-- IR_SECTION:capability -->
## 能力范围
完全不看代码；所有验收都通过页面完成。

<!-- IR_SECTION:progress -->
## 进度
0/2 步已完成。

<!-- IR_SECTION:usage -->
## 使用方法
按批次开启开发 Session；复制当前步骤提示词，按最多两项条目验收，明确回复通过后再继续。

<!-- IR_SECTION:git -->
## Git 状态
- 本地 Git：已启用
- 工作区：clean
- 当前分支：main
- GitHub：未连接（不影响本地并行）
- 整合分支：ir/task-list
- 提交时机：每个步骤验收通过后
- 推送时机：未连接远程仓库，本 Roadmap 不推送

<!-- IR_SECTION:sessions -->
## Session 安排
- 第 1 批（串行）：子步骤 1
- 第 2 批（串行）：子步骤 2

<!-- IR_SECTION:steps -->
## 开发步骤

<!-- IR_STEP {"id":"step-01","label":"1","status":"pending","kind":"frontend","evidence":"ui","data":"mock","batch":1,"execution":"serial","dependsOn":[],"files":["web/task-list/**"],"gitAction":"create-integration-branch","branch":"ir/task-list","push":"none"} -->
**🧩 子步骤 1：可点击的任务列表**

<!-- IR_FIELD:session -->
➡️ 串行 Session｜第 1 批｜等待：无｜文件范围：web/task-list/**

<!-- IR_FIELD:git -->
🌿 Git｜从 main 的干净基线新建整合分支：ir/task-list｜验收通过后提交｜本步不推送

<!-- IR_FIELD:prompt -->
📋 第 1 步 — 复制以下提示词发给开发 AI：

```text
请只实现任务列表页面，按约定字段使用演示数据。

🎯 要求：
- 交付一个可打开的任务列表页，展示清楚标注的演示任务和状态筛选。
- 只修改这些文件或目录：web/task-list/**。
- 若需要改动范围外文件或发现与其他 Session 冲突，立即停止并说明。
- 开始前确认所有前置步骤已经通过；不要改动其他未完成 Session 的工作。
- 从当前 main 的干净基线新建并切换到 ir/task-list，再开始本步开发。
- 保留用户已有改动，不得擅自 stash、覆盖或清理。
- 开发完成后先停止；收到“1 通过，请继续。”后才提交当前文件范围。
- 本步骤禁止推送远程。
- 运行必要的前端检查。
- 说明打开页面的方法。
- 完成后停止并等待我的验收。
- 只有我明确回复通过，才能把 step-01 改成 completed。

⚠️ 约束：不要实现保存或权限。

<!-- IR_GUARD:current-step-only,run-checks,stop-for-acceptance -->
<!-- IR_SESSION_GUARD:file-scope,no-cross-session-edits,stop-on-conflict -->
<!-- IR_GIT_GUARD:commit-after-acceptance,no-auto-push,preserve-user-changes -->

【🚧 边界条件】
<!-- IR_FIELD:boundaries -->
- 不接真实接口，不实现新增、权限或数据写入。
- 页面必须明确这是演示状态。

【✅ 验收标准】
<!-- IR_FIELD:acceptance -->
- 按开发 AI 给出的地址打开页面，能看到任务列表。
- 页面明确显示演示数据，新增按钮没有伪装成可用。
```

<!-- IR_FIELD:checklist -->
☑️ 第 2 步 — 人工验收清单（2 项）：
- [ ] 按开发 AI 给出的地址打开页面，能看到任务列表。
- [ ] 页面明确显示演示数据，新增按钮没有伪装成可用。

<!-- IR_FIELD:reply -->
💬 第 3 步 — 回复：`1 通过，请继续。`

<!-- IR_STEP_END -->

<!-- IR_STEP {"id":"step-02","label":"2","status":"pending","kind":"integration","evidence":"ui","data":"real","batch":2,"execution":"serial","dependsOn":["step-01"],"files":["web/task-list/**","server/task-read/**"],"gitAction":"stay","branch":"ir/task-list","push":"none"} -->
**🧩 子步骤 2：接入真实任务数据**

<!-- IR_FIELD:session -->
➡️ 串行 Session｜第 2 批｜等待：子步骤 1｜文件范围：web/task-list/**、server/task-read/**

<!-- IR_FIELD:git -->
🌿 Git｜继续使用整合分支：ir/task-list｜验收通过后提交｜本步不推送

<!-- IR_FIELD:prompt -->
📋 第 1 步 — 复制以下提示词发给开发 AI：

```text
请只把现有任务列表接入真实读取接口，不新增编辑功能。

🎯 要求：
- 让同一个任务列表页展示真实任务、空状态和失败提示。
- 只修改这些文件或目录：web/task-list/**、server/task-read/**。
- 若需要改动范围外文件或发现与其他 Session 冲突，立即停止并说明。
- 开始前确认子步骤 1 已通过；不要改动其他未完成 Session 的工作。
- 保留用户已有改动，不得擅自 stash、覆盖或清理。
- 开发完成后先停止；收到“2 通过，请继续。”后才提交当前文件范围。
- 本步骤禁止推送远程。
- 运行接口和前端必要检查。
- 提供可复现的样例数据。
- 完成后停止并等待我的验收。
- 只有我明确回复通过，才能把 step-02 改成 completed。

⚠️ 约束：不重新设计已经通过验收的页面。

<!-- IR_GUARD:current-step-only,run-checks,stop-for-acceptance -->
<!-- IR_SESSION_GUARD:file-scope,no-cross-session-edits,stop-on-conflict -->
<!-- IR_GIT_GUARD:commit-after-acceptance,no-auto-push,preserve-user-changes -->

【🚧 边界条件】
<!-- IR_FIELD:boundaries -->
- 只读真实数据。
- 新增、删除和权限仍不在本步范围。

【✅ 验收标准】
<!-- IR_FIELD:acceptance -->
- 刷新同一页面后能看到开发 AI 指定的真实样例任务。
- 空数据和接口失败时，页面给出能理解的提示。
```

<!-- IR_FIELD:checklist -->
☑️ 第 2 步 — 人工验收清单（2 项）：
- [ ] 刷新同一页面后能看到开发 AI 指定的真实样例任务。
- [ ] 空数据和接口失败时，页面给出能理解的提示。

<!-- IR_FIELD:reply -->
💬 第 3 步 — 回复：`2 通过，请继续。`

<!-- IR_STEP_END -->
<!-- IDIOTS_ROADMAP:END -->
````
