# Roadmap 输出协议

## 目录

- 最终标记
- Roadmap 正文
- 步骤元数据
- 完整示例

## 最终标记

跳过时只在最终计划末尾输出：

```html
<!-- IDIOTS_ROADMAP:OPTOUT -->
```

启用时输出：

```html
<!-- IDIOTS_ROADMAP:BEGIN {"version":1,"action":"new","capability":{"mode":"no-code","description":"完全不看代码"},"goal":"让用户能创建并查看任务","language":"zh-CN","project":{"hasFrontend":true}} -->
...完整 Roadmap Markdown...
<!-- IDIOTS_ROADMAP:END -->
```

约束：

- `action` 只能是 `new` 或 `update`。
- `capability.mode` 使用 `no-code`、`code-reader` 或 `custom`。
- `capability.description` 原样记录用户选择或自定义描述。
- `goal` 用一句稳定、具体的话描述目标；同一 Roadmap 更新时不要改写。
- `project.hasFrontend` 必须是布尔值。
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

<!-- IR_SECTION:steps -->
## 开发步骤
...
````

使用方法应告诉用户：复制当前步骤的提示词给开发 AI；开发 AI 停止后按验收条目检查；明确回复通过后再进行下一步。

## 步骤元数据

每步必须完整使用以下结构：

````markdown
<!-- IR_STEP {"id":"step-01","label":"1","status":"pending","kind":"frontend","evidence":"ui","data":"mock"} -->
**🧩 子步骤 1：可理解的结果名称**

<!-- IR_FIELD:prompt -->
📋 第 1 步 — 复制以下提示词发给开发 AI：

```text
请只实现当前子步骤。

🎯 要求：
- 交付一个用户能直接验收的具体结果。
- ...

⚠️ 约束：...

<!-- IR_GUARD:current-step-only,run-checks,stop-for-acceptance -->

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
💬 第 3 步 — 回复：`1 通过，请继续。`

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
- 开发提示词必须包含完整的 `IR_GUARD`，并用自然语言说明具体实现范围、技术检查和停止条件。
- 用户验收使用 Markdown 列表，必须有 1–2 项。
- 无代码模式不得使用 `code` 或 `diff` 作为 evidence。
- 无代码且有前端时，第一步必须为 `kind:"frontend"`、`evidence:"ui"`。
- 如果任一步使用 `data:"mock"`，必须有更后的 `kind:"integration"`、`evidence:"ui"`、`data:"real"` 步骤。
- 演示数据和未实现的高风险能力必须在“要求”和“边界条件”中明确标注。

## 完整示例

````html
<!-- IDIOTS_ROADMAP:BEGIN {"version":1,"action":"new","capability":{"mode":"no-code","description":"完全不看代码"},"goal":"让用户能查看任务列表","language":"zh-CN","project":{"hasFrontend":true}} -->
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
复制当前步骤提示词给开发 AI，按最多两项条目验收，明确回复通过后再继续。

<!-- IR_SECTION:steps -->
## 开发步骤

<!-- IR_STEP {"id":"step-01","label":"1","status":"pending","kind":"frontend","evidence":"ui","data":"mock"} -->
**🧩 子步骤 1：可点击的任务列表**

<!-- IR_FIELD:prompt -->
📋 第 1 步 — 复制以下提示词发给开发 AI：

```text
请只实现任务列表页面，按约定字段使用演示数据。

🎯 要求：
- 交付一个可打开的任务列表页，展示清楚标注的演示任务和状态筛选。
- 运行必要的前端检查。
- 说明打开页面的方法。
- 完成后停止并等待我的验收。
- 只有我明确回复通过，才能把 step-01 改成 completed。

⚠️ 约束：不要实现保存或权限。

<!-- IR_GUARD:current-step-only,run-checks,stop-for-acceptance -->

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

<!-- IR_STEP {"id":"step-02","label":"2","status":"pending","kind":"integration","evidence":"ui","data":"real"} -->
**🧩 子步骤 2：接入真实任务数据**

<!-- IR_FIELD:prompt -->
📋 第 1 步 — 复制以下提示词发给开发 AI：

```text
请只把现有任务列表接入真实读取接口，不新增编辑功能。

🎯 要求：
- 让同一个任务列表页展示真实任务、空状态和失败提示。
- 运行接口和前端必要检查。
- 提供可复现的样例数据。
- 完成后停止并等待我的验收。
- 只有我明确回复通过，才能把 step-02 改成 completed。

⚠️ 约束：不重新设计已经通过验收的页面。

<!-- IR_GUARD:current-step-only,run-checks,stop-for-acceptance -->

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
