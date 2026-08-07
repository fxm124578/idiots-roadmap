# V3 Roadmap 协议

## 目录

- 最终标记
- 状态结构
- 当前工作项
- 更新与迁移
- 最小示例

## 最终标记

跳过时输出：

```html
<!-- IDIOTS_ROADMAP:OPTOUT -->
```

启用时建立一个状态块。不要手写用户 Roadmap；hook 或便携式状态工具会从状态生成唯一用户文档。

```html
<!-- IDIOTS_ROADMAP:BEGIN {"version":3,"action":"new","roadmapId":"rm_example001","revision":1,"baseRevision":null} -->
<!-- IR_STATE:BEGIN
{ ...完整 V3 JSON... }
IR_STATE:END -->
<!-- IDIOTS_ROADMAP:END -->
```

`action` 只能是 `new` 或 `update`。新目标使用 revision 1、baseRevision null；同一目标更新使用当前 revision + 1，并把当前 revision 写入 baseRevision。

## 落盘方式

落盘方式由宿主能力决定，状态内容和验证规则完全相同：

- `hook`：只有上下文明确包含 `IDIOTS_ROADMAP_LANDING_MODE: hook` 时使用。最终回答输出状态块，hook 负责原子落盘。
- `direct`：没有 hook 标记且允许写规划控制产物时使用。把 JSON 候选保存为 `.idiotsroadmap/initial-state.json`，再运行本 Skill 自带的 `scripts/roadmap-state.mjs bootstrap`。
- `deferred-direct`：系统硬性禁止 Plan 中所有写入时使用。Plan 回复保留完整状态块；用户确认 Plan、宿主解除只读后，只执行候选写入与 `bootstrap`，随即停止。

Plan 写入例外仅覆盖 `IDIOTS_ROADMAP.md`、`.idiotsroadmap/state.json`、`.idiotsroadmap/runtime/`、`.idiotsroadmap/archive/` 和同目录临时候选文件。不得借此修改产品代码、普通文档、配置、依赖或 Git 状态。系统层面的硬限制永远优先，不得绕过。

首次直接落盘命令：

```text
node <idiots-roadmap Skill 目录>/scripts/roadmap-state.mjs bootstrap .idiotsroadmap/initial-state.json <项目根目录>
```

成功输出必须显示 `action: bootstrapped`、`approval: proposed` 和 `stop: true`。已有 V3 状态不得再次 bootstrap；更新统一使用项目内 runtime 的 `apply` 命令。

## 状态结构

必需顶层字段：

```json
{
  "schemaVersion": 3,
  "roadmapId": "rm_example001",
  "revision": 1,
  "baseRevision": null,
  "goal": {
    "summary": "让用户管理个人任务",
    "success": "用户可以创建、完成并重新打开任务",
    "nonGoals": ["团队协作", "付费功能"]
  },
  "capability": {
    "mode": "no-code",
    "description": "完全不看代码"
  },
  "project": {
    "origin": "existing",
    "managementMode": "managed",
    "hasFrontend": true,
    "analysis": {
      "summary": "已有可运行页面，任务数据仍使用演示内容。",
      "fingerprint": "64 位扫描指纹",
      "stateRevision": 1,
      "baseCommit": null,
      "evidence": [],
      "unresolved": []
    }
  },
  "repository": {
    "isGitRepo": false,
    "workingTree": "unknown",
    "currentBranch": null,
    "remoteProvider": "none",
    "remoteName": null,
    "githubMode": "create-private",
    "integrationBranch": "ir/tasks/integration",
    "workspaceStrategy": null,
    "baseCommit": null,
    "pushPolicy": "manual-after-final-acceptance"
  },
  "milestones": [],
  "modules": [],
  "contracts": [],
  "workItems": [],
  "changes": [],
  "decisions": [],
  "current": {
    "batch": 1,
    "workItemIds": ["work_task_page"],
    "approval": {
      "proposalId": "proposal_task001",
      "status": "proposed",
      "batch": 1,
      "workItemIds": ["work_task_page"],
      "summary": "让任务列表真正可以使用",
      "visibleResults": ["可以切换任务完成状态", "刷新后状态仍然保留"],
      "nonGoals": ["多人协作"],
      "reason": "列表页面已经存在，先补齐最短的完整使用流程。",
      "proposedAtRevision": 1,
      "approvedAtRevision": null
    }
  }
}
```

### 证据

模块、合同和项目分析的 `evidence` 使用：

```json
{
  "confidence": "observed",
  "summary": "页面入口引用了任务列表模块。",
  "path": "src/pages/tasks.tsx"
}
```

`confidence` 只能是 `verified`、`observed`、`declared`、`conflict` 或 `unknown`。路径必须是项目相对路径，不得保存用户绝对路径。

### 模块

```json
{
  "id": "mod_tasks",
  "name": "任务管理",
  "responsibility": "管理任务的创建、完成和读取",
  "nonResponsibilities": ["账号权限"],
  "files": ["src/tasks/**"],
  "userOutcome": "用户可以查看和操作任务",
  "evidence": []
}
```

模块根据职责、数据所有权和变更耦合划分，不等同于目录。

### 接口合同

```json
{
  "id": "ctr_task_record",
  "name": "任务记录",
  "version": "1",
  "provider": "mod_tasks",
  "consumers": ["mod_task_page"],
  "kind": "data",
  "summary": "页面读取任务标题、状态和更新时间",
  "compatibility": "新增可选字段保持兼容",
  "evidence": []
}
```

### 里程碑

```json
{
  "id": "ms_basic_flow",
  "title": "基本任务流程",
  "outcome": "用户可以创建并完成任务",
  "status": "active"
}
```

状态使用 `planned`、`active`、`completed` 或 `superseded`。

## 当前工作项

```json
{
  "id": "work_task_page",
  "title": "打开并操作任务列表",
  "outcome": "用户可以看到任务并切换完成状态",
  "kind": "frontend",
  "dataMode": "real",
  "status": "planned",
  "milestoneId": "ms_basic_flow",
  "moduleIds": ["mod_task_page"],
  "contractIds": ["ctr_task_record"],
  "batch": 1,
  "execution": "serial",
  "dependsOn": [],
  "files": ["src/task-page/**"],
  "session": {
    "strategy": "shared-directory",
    "baseCommit": null,
    "prompt": ""
  },
  "completion": {
    "authority": "user-experience",
    "acceptance": [
      "打开任务页，能看到任务列表并切换完成状态。",
      "刷新页面后，刚才的状态仍然保留。"
    ],
    "review": {
      "status": "pending",
      "summary": ""
    }
  }
}
```

不要预写完整 `session.prompt`。Plan 和 Finish 只保存工作结果、模块、接口、文件范围与批准卡；Start 在用户批准并领取任务后，依据最新项目即时编译内部开发指令。读取旧 V3 Roadmap 时可以保留带保护标记的旧提示词，但重新生成后应清空。

工作状态使用：`planned`、`ready`、`in_progress`、`technical_verified`、`awaiting_user`、`accepted`、`blocked`、`superseded`。

完成权限：

- `user-experience`：1–2 项真实体验。
- `ai-review`：acceptance 必须为空；review 由独立 Agent 或复核 Session 完成。

## 版本保护

`repository.githubMode` 必须记录用户选择：

- `connected`：已经连接远程仓库。
- `create-private`：用户选择创建私人 GitHub 仓库。
- `connect-existing`：用户选择连接已有 GitHub 仓库。
- `local-only`：用户选择暂时只保存在本机。

没有本地 Git 时，当前批次必须串行，结果卡说明第一轮开始前由 AI 建立本地版本保护且不会上传。Plan 只记录选择；初始化 Git、登录检查、创建或连接仓库都放在用户批准后的 Start 预检中。公开仓库必须单独确认，任何 push 继续遵守 `manual-after-final-acceptance`。

## 当前批次批准门

`current.approval.status` 只能是 `proposed` 或 `approved`：

- Plan 和 Finish 只能创建 `proposed`，对应工作项保持 `planned`。
- 用户在 Finish 后或 Start 中明确同意时，运行 `roadmap-state.mjs approve`；该命令原子写入 `approved`，并把当前 `planned` 工作变为 `ready`。
- Start 只领取 `approved` 批次中的 `ready` 工作，运行 `roadmap-state.mjs claim` 后变为 `in_progress` 并记录 `claimId`。
- 改变标题、用户结果、演示/真实数据、体验验收或本批不做内容时，必须使用新的 `proposalId` 并回到 `proposed`。
- 只改变内部实现、测试或文件位置时可以保留批准。
- 旧 V3 状态缺少 approval 时按“尚未批准”处理，不能直接开发。

收尾时把候选状态写到 `.idiotsroadmap/next-state.json`，再运行：

```text
node .idiotsroadmap/runtime/roadmap-state.mjs apply .idiotsroadmap/next-state.json
```

状态工具成功后立即停止，不执行新接力卡。

## 变更

```json
{
  "id": "chg_task_fields",
  "kind": "contract-change",
  "status": "active",
  "summary": "任务记录增加可选截止日期。",
  "affectedModules": ["mod_tasks", "mod_task_page"],
  "affectedContracts": ["ctr_task_record"],
  "unaffected": ["账号流程"],
  "decisionNeeded": ""
}
```

`kind` 使用 `current-adjustment`、`backlog`、`module-change`、`contract-change` 或 `goal-change`。只更新受影响的未完成工作；已接受历史保持不变。

## 并行

同一并行批次：

- 全部工作项使用 `execution: parallel`；
- 文件范围不得重叠；
- 最多三个工作项；
- 下一批必须有且只有一个 `kind: integration` 的串行工作项；
- 整合工作项的 `dependsOn` 包含本批全部工作项。

`repository.workspaceStrategy` 可为 `codex-managed-worktree`、`claude-managed-worktree`、`manual-worktree`、`shared-directory` 或 null。无法确认安全隔离时改为串行。

## 更新与迁移

- V3 更新必须匹配当前 roadmapId 和 baseRevision。
- `accepted` 与 `technical_verified` 工作项不可删除或改写。
- `source: user` 的决定不可自动删除或改写。
- 新目标使用新的 roadmapId，并归档旧 Roadmap 与状态。
- V1/V2 首次迁移使用 `action:update`、revision 1、baseRevision null，并增加：

```json
{
  "migration": {
    "fromVersion": 2
  }
}
```

迁移时把旧完成步骤压缩进已完成工作历史；每个迁移后的工作项用 `legacyStepId` 记录原步骤 ID。不要把旧步骤提示词继续复制进用户文档。缺少任一旧完成步骤时，hook 会拒绝迁移并保留旧文件。

## 最小示例

下面只展示结构。实际输出必须补齐仓库事实与证据。

```html
<!-- IDIOTS_ROADMAP:BEGIN {"version":3,"action":"new","roadmapId":"rm_demo0001","revision":1,"baseRevision":null} -->
<!-- IR_STATE:BEGIN
{
  "schemaVersion": 3,
  "roadmapId": "rm_demo0001",
  "revision": 1,
  "baseRevision": null,
  "goal": {"summary":"完成个人任务流程","success":"用户可以创建并完成任务","nonGoals":["多人协作"]},
  "capability": {"mode":"no-code","description":"完全不看代码"},
  "project": {"origin":"new","managementMode":"simple","hasFrontend":true,"analysis":{"summary":"项目刚初始化。","fingerprint":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","stateRevision":1,"baseCommit":null,"evidence":[],"unresolved":[]}},
  "repository": {"isGitRepo":false,"workingTree":"unknown","currentBranch":null,"remoteProvider":"none","remoteName":null,"githubMode":"local-only","integrationBranch":"ir/tasks/integration","workspaceStrategy":null,"baseCommit":null,"pushPolicy":"manual-after-final-acceptance"},
  "milestones": [{"id":"ms_basic","title":"任务基本流程","outcome":"可以查看并完成任务","status":"active"}],
  "modules": [{"id":"mod_page","name":"任务页面","responsibility":"展示和操作任务","nonResponsibilities":["账号权限"],"files":["src/tasks/**"],"userOutcome":"可以查看并完成任务","evidence":[]}],
  "contracts": [],
  "workItems": [{"id":"work_page","title":"打开任务列表","outcome":"看到可操作的任务列表","kind":"frontend","dataMode":"real","status":"planned","milestoneId":"ms_basic","moduleIds":["mod_page"],"contractIds":[],"batch":1,"execution":"serial","dependsOn":[],"files":["src/tasks/**"],"session":{"strategy":"shared-directory","baseCommit":null,"prompt":""},"completion":{"authority":"user-experience","acceptance":["打开任务页，能看到并操作任务列表。"],"review":{"status":"pending","summary":""}}}],
  "changes": [],
  "decisions": [],
  "current": {"batch":1,"workItemIds":["work_page"],"approval":{"proposalId":"proposal_demo001","status":"proposed","batch":1,"workItemIds":["work_page"],"summary":"先做出可操作的任务列表","visibleResults":["打开页面后可以看到并操作任务列表"],"nonGoals":["多人协作"],"reason":"这是最早可以直接体验的完整结果。","proposedAtRevision":1,"approvedAtRevision":null}}
}
IR_STATE:END -->
<!-- IDIOTS_ROADMAP:END -->
```
