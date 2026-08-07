---
name: idiots-roadmap
description: 在 Plan 模式中为新项目或已有项目建立 Idiots Roadmap 总计划。自动分析目标或现有代码、文档、数据与测试，按职责拆分模块和接口，只提出当前批次的用户结果与边界，生成等待用户批准的 IDIOTS_ROADMAP.md 和项目状态。适用于 Codex、Claude Code 或 Proma Pi 中开始长期开发、重做总目标、接管存量项目和规划多 Session 并行；支持有 hooks、无 hooks 和 Plan 硬只读场景。日常继续、收尾和项目对齐分别使用 $idiots-roadmap-start、$idiots-roadmap-finish 和 $idiots-roadmap-align。
---

# Idiots Roadmap

把计划变成可跨 Session 延续的项目接力系统。锁定目标、模块和接口；只展开当前批次；让用户少读、少判断、少维护。

## 边界

- 只在明确的 Plan 模式运行。用户显式调用本 Skill 本身也可作为进入规划流程的意图，但宿主明确报告非 Plan 时停止。
- 只分析、规划、校验和保存规划控制产物，不退出 Plan、不开始开发、不自动打开下一 Session。
- Plan 中唯一允许写入的是 `IDIOTS_ROADMAP.md` 与 `.idiotsroadmap/` 内的状态、运行工具、归档和临时候选文件；产品代码、普通文档、配置、依赖和 Git 状态保持只读。
- 宿主从系统层面禁止所有写入时，不尝试绕过；先生成待落盘状态，等宿主解除只读后只完成落盘并停止。
- 不调用网络、外部 API 或额外模型。
- 分析已有项目时只读；不安装依赖、不修改产品文件、不启动高风险服务。
- 输出完成后立即停止。

## 开始前选择

同一目标尚未选择时分两轮询问：

1. `启用 Idiots Roadmap` / `本轮不启用`。
2. 启用后询问能力：始终提供 `完全不看代码`，再提供最多两个已检测语言选项，并保留原生“其他”。

不启用时输出 `<!-- IDIOTS_ROADMAP:OPTOUT -->`。同一目标后续澄清不重复询问。

能力变化只约束受影响的未完成工作。已接受历史和用户明确决定保持不变。

## 选择版本保护

只读检测本地 Git 和远程仓库。没有本地 Git 时不让用户处理命令：在首批结果卡说明“第一轮开始前由 AI 建立本地版本保护，不会上传网络”，并把首批设为串行。

尚未连接远程仓库且现有状态没有保存选择时，只追加一次：

1. `创建新的私人 GitHub 仓库`（推荐，防止本机损坏导致项目丢失）。
2. `暂时只保存在本机`。
3. `连接已有 GitHub 仓库`。

把选择保存为 `repository.githubMode`：`create-private`、`local-only` 或 `connect-existing`。已连接远程时使用 `connected`。Plan 只记录选择，不登录、不创建仓库、不添加 remote、不推送。

## 判断项目来源

自动判断，不要求用户选择：

- 没有实质代码和项目记录：`project.origin: new`。
- 存在代码、清单、Git 历史或开发记录：`project.origin: existing`。

简单项目使用 `managementMode: simple`；存在多模块、跨模块数据、接口、迁移或并行需求时使用 `managed`。自行判断，除非用户主动指定。

## 接管已有项目

采用 `../idiots-roadmap-align/SKILL.md` 的证据分级和差异分类规则，但仍由本 Skill 在 Plan 模式建立正式基线。

使用 hook 摘要作为入口，并继续检查仓库。读取与当前目标有关的：

- 项目规则、README、当前状态和旧计划；
- 入口、页面、路由、API、公共类型和事件；
- 数据库结构、迁移、存储键和配置；
- 测试、fixture 和可运行证据；
- 本地 Git 状态与近期相关历史。

不要按文件夹机械拆模块。结合职责、数据所有权、变更耦合、依赖关系、可独立交付结果和文件冲突划分。

每条关键结论标记证据可信度：

- `verified`：实际运行或有效测试确认。
- `observed`：代码或结构中存在，尚未运行确认。
- `declared`：只在文档或旧计划中声明。
- `conflict`：证据互相矛盾。
- `unknown`：证据不足。

代码存在不等于功能完成，旧计划也不等于事实。区分已验证完成、已实现未验证、开发中、仅规划、已替代和未知。

技术冲突进入 AI 复核；只有冲突改变产品含义或优先级时才询问用户。重新分析只更新变化部分，保留用户决定和已接受历史。

## 建立项目骨架

先固定：

1. 一句话目标、成功结果和明确不做的内容。
2. 用户可感知的里程碑。
3. 模块职责、不负责内容、文件归属和用户结果。
4. 模块提供与消费的接口合同：提供方、使用方、版本、兼容性、证据。
5. 工作项依赖、当前批次和未来骨架。
6. 本地版本保护与 GitHub 去向；没有 Git 时首批必须串行。
7. 每个工作项的 Git 去向：串行与整合工作使用 `repository.integrationBranch`；隔离并行工作使用 `ir/<roadmapId>/<workItemId>`；共享目录并行使用 `branch: null`。

提示词不是事实源。目标、模块、合同和状态进入 `.idiotsroadmap/state.json`；`IDIOTS_ROADMAP.md` 只是自动渲染的用户视图。

## 只提出当前批次

- 当前批次包含 1–3 个 `planned` 工作项，不保存完整开发提示词。
- 为当前批次生成 `current.approval` 结果卡，状态必须是 `proposed`，包括下一轮做什么、1–2 个可见结果、本轮不做什么和为什么现在做。
- 用户明确批准前不得把工作改成 `ready`，不得领取或开始开发。
- 非当前工作项只保存结果、依赖、模块和边界。
- 用户批准后由 `$idiots-roadmap-start` 在新 Session 读取最新项目，原子领取任务并即时编译内部开发指令。
- 用户可以在上一轮 Finish 后或新的 Start Session 中批准；沉默和 AI 自己的判断不算批准。

## 分配验收权限

### `user-experience`

只用于用户可以亲自体验的页面、操作、视觉、样例输入输出或产品决定：

- 验收 1–2 项。
- 完全不看代码时，不提代码、diff、终端、日志、测试报告、提交或 AI 的完成声明。
- 能看代码时，只能在用户明确选择的语言中使用代码或 diff，且只要求阅读，不要求修改；自定义能力不得自动扩大。
- 有前端时尽快交付相关可打开流程；演示数据必须标明，真实接入后通过同一流程再次体验。
- 用户通过后，由 `$idiots-roadmap-finish` 完成收尾和对应提交。

### `ai-review`

用于接口、迁移、测试、安全、状态模型和其他技术结果：

- 用户验收数组必须为空。
- 优先由独立复核 Agent 检查，主 Agent 比较开发结果与复核结果。
- 一致时只显示一句结论；有分歧先由 AI 修复。
- 宿主不能提供独立 Agent 时，由 Finish Skill 安排独立复核 Session。
- 复核一致后可以建立技术检查点，但仍不得自动开始下一工作项。

## 管理变化

自动分类：

- `current-adjustment`：当前工作内部修正，留在当前 Session。
- `backlog`：不阻塞的新想法，只记录，不插入当前路线。
- `module-change`：只调整相关模块的未完成工作。
- `contract-change`：建立变更记录，列出受影响提供方和使用方，安排兼容或迁移及整合关卡。
- `goal-change`：归档旧 Roadmap，建立新目标。

已完成内容不重写。不要在用户文档中不断插入复合编号；变化通过稳定 ID 和变更记录管理。

## 安排并行

只有同时满足以下条件才标记并行：

- 共享合同已经确定；
- 文件范围不重叠；
- 共同 `baseCommit` 已确认；
- 紧接一个唯一串行整合工作项；
- 同批最多 3 个 Session。

路由、数据库结构、全局配置、锁文件、权限、共享状态和公共设计默认串行。根据宿主选择一种 `workspaceStrategy`：Codex 托管 Worktree、Claude 托管 Worktree、手动 Worktree 或共享目录。无法确认隔离时改为串行。

共享目录并行时不切分支、不暂存、不提交，由整合 Session 统一收口。Skill 只建立编排，不声称已经创建 Session、分支或 Worktree。

为每个工作项写入 `session.branch`。独立并行分支必须稳定、互不重复且不能占用整合分支；不要把绝对 Worktree 路径写入状态。Start 负责实际创建或进入分支，Finish 负责验收后的本地提交，整合工作负责合并依赖分支。

独立 Worktree 需要在共同基线中包含 `IDIOTS_ROADMAP.md`、`.idiotsroadmap/state.json` 和 `.idiotsroadmap/runtime/`，否则 Start Skill 无法接力。`.idiotsroadmap/next-state.json` 是临时文件，状态工具成功后会删除，不得提交。用户不希望把项目管理状态放入版本记录时，取消独立 Worktree 并改为共享目录或串行。任何远程推送仍需用户明确授权。

## 输出

完整读取 [references/roadmap-protocol.md](references/roadmap-protocol.md)，生成 V3 BEGIN/END 和 IR_STATE 状态块。

### 先选择落盘方式

按能力检测选择，不能同时使用两种：

1. `hook`：当前上下文明确包含 `IDIOTS_ROADMAP_LANDING_MODE: hook`。只在最终回答输出 V3 状态块，由 hook 落盘；不得再运行便携式工具。
2. `direct`：没有 hook 标记，且宿主允许写规划控制产物。把完整 JSON 写入项目内 `.idiotsroadmap/initial-state.json`，运行本 Skill 目录下的 `scripts/roadmap-state.mjs bootstrap <候选文件> <项目根目录>`。成功后确认状态仍为 `proposed`，然后停止。
3. `deferred-direct`：没有 hook 标记，且系统硬性禁止 Plan 中任何写入。不要用其他工具绕过。最终回答保留完整 V3 状态块并明确“等待 Plan 确认后落盘”。宿主解除只读后的第一项动作，是把该状态写入 `.idiotsroadmap/initial-state.json` 并运行同一 `bootstrap` 命令；成功后立即停止，不执行产品开发。

Proma Pi 默认使用 `direct`；若其当前 Plan 实现硬只读，则使用 `deferred-direct`。不要等待 Claude/Codex 的 `permission_mode`、`ExitPlanMode` 或 Stop hook。

首次落盘后会生成：

- `.idiotsroadmap/state.json`：唯一机器事实源。
- `.idiotsroadmap/runtime/`：项目本地的零依赖校验与渲染工具，新 Session 不需要猜插件安装路径。
- `IDIOTS_ROADMAP.md`：唯一用户进度文档。

新目标覆盖前归档旧 Roadmap。更新必须校验 `baseRevision`；旧 Session、校验失败和路径异常都不得覆盖现有文件。

系统 Plan 的确认只允许完成这次规划基线落盘，不代表用户批准 `current.approval`。Roadmap 落盘后停止，不退出 Plan，不开始开发。
