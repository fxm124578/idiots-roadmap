# Idiots Roadmap 项目规则

## 产品边界

- 当前发布支持 Codex、Claude Code 与 Proma Pi；OpenCode、Hermes 和其他宿主暂不适配。
- 主 Skill `idiots-roadmap` 只在 Plan 模式建立或重建项目管理基线；非 Plan 模式的自动 hooks 必须静默。
- 配套 Skill `idiots-roadmap-start`、`idiots-roadmap-finish` 和 `idiots-roadmap-align` 只能由用户显式调用或明确的自然语言触发，不依赖非 Plan hooks 偷偷启动。
- Idiots Roadmap 是项目接力系统，不是详细步骤生成器。它负责锁定目标、模块、接口、变更影响和下一批 Session，不预写整个项目的完整开发提示词。
- hooks 是可选的自动化适配层，不是核心运行前提。支持 hooks 时可自动询问、注入协议、校验和落盘；不支持 hooks 时由主 Skill 直接或延后落盘。
- 自动化不得批准计划、退出 Plan、开始开发或持续监听反馈。
- Plan、hooks 和只读分析不调用外部 API、额外模型或网络服务，不在全局位置保存用户能力。Start 只有在用户明确选择 GitHub 方案后，才可调用本机已安装且已登录的 GitHub 工具完成该方案。

## 文档与交互

- 项目文档默认使用中文；代码标识符、协议字段和命令使用英文。
- `README.md` 中文优先；生成的 Roadmap 跟随当前对话语言。
- 面向不会开发的用户解释“为什么”和“对用户的影响”，避免只描述实现。
- `IDIOTS_ROADMAP.md` 是唯一面向用户的项目进度文档；机器事实统一保存在 `.idiotsroadmap/state.json`，不得再为每个步骤创建验收报告。
- 用户只验收真实可交互结果和产品方向。技术任务由独立复核 Agent 验证；宿主不能提供独立 Agent 时，生成复核 Session 接力，不把技术判断转交给用户。
- 用户体验验收每个工作项最多两项；无代码模式不得要求查看代码、终端、日志、测试报告、提交或 AI 的“已完成”声明。
- 技术复核一致时只向用户显示一句结论；仅在存在分歧或需要产品取舍时展开说明。
- Roadmap 必须用用户能理解的方式标明当前批次、串行或并行 Session、前置依赖和允许修改的文件范围；未来批次只保留里程碑骨架，不预写完整提示词。
- 并行能力面向“多个开发 Session 同时操作项目”；分支或 worktree 只作为开发 AI 的隔离手段，不增加用户必须执行的 Git 操作。
- Roadmap 必须只读检测并显示本地 Git、工作区状态、远程仓库提供方、整合分支和推送策略；不得把 GitHub 连接作为并行开发的前提。
- 未初始化 Git 时，Roadmap 必须用大白话说明“第一轮开始前由 AI 建立本地版本保护，不会上传网络”，并把首批安排为串行；不得要求用户执行 Git 命令。
- 未连接远程仓库时，Plan 必须只询问一次 GitHub 去向：创建私人仓库、暂时只保存在本机、连接已有仓库；选择结果写入项目状态，后续 Session 不重复询问。
- Roadmap 必须展示一段简短“版本保护”状态，告诉用户当前是否有本地历史、是否有云端备份、下一步由谁处理；不得只显示分支名等技术信息。
- 当前 Session 完成收尾后只能提出下一批用户结果并停止。用户明确批准前，任何新 Session 都不得领取或开发下一批。
- 用户可以在上一轮收尾后或新 Session 启动时批准下一批；批准只确认用户结果和边界，不要求用户审核技术提示词。
- 新 Session 由 `idiots-roadmap-start` 自动读取项目状态；不得要求用户复制或维护长提示词。详细开发提示词只能在批准后依据最新项目状态即时编译。
- 系统对 Plan 的确认只代表允许保存本次规划基线，不等于批准下一批开发；下一批仍按独立批准门处理。

## 目录职责

- `skills/idiots-roadmap/`：Plan 模式总规划 Skill。
- `skills/idiots-roadmap-start/`：新开发 Session 的读取、批准门、任务领取与即时提示词编译。
- `skills/idiots-roadmap-finish/`：当前任务验证、必要文档同步、进度更新和下一批提案。
- `skills/idiots-roadmap-align/`：已有项目扫描、计划与项目差异分类及纠偏建议。
- `hooks/`：Codex 与 Claude Code 共用 hook 配置和零依赖 Node.js 脚本。
- `skills/idiots-roadmap/scripts/`：不依赖 hooks 的便携式初始化、校验与落盘工具，供 Proma Pi 和其他无 hook 场景使用。
- `.codex-plugin/`：Codex 插件清单。
- `.claude-plugin/`：Claude Code 插件清单。
- `.agents/plugins/`：Codex GitHub marketplace 清单。
- `.claude-plugin/marketplace.json`：Claude Code GitHub marketplace 清单。
- `tests/`：`node:test` 测试、fixture 与黄金样例。
- `.github/workflows/`：跨平台 CI。
- 根目录文档只放用户需要的项目说明、许可和贡献规则。

## 命名与格式

- 文件与目录优先使用小写 kebab-case；宿主规定的固定文件名除外。
- JavaScript 使用 ESM `.mjs`，仅依赖 Node.js 18+ 标准库。
- JSON 使用 2 空格缩进并以换行结尾。
- 内部 Roadmap 协议字段使用稳定英文名，用户可见内容按会话语言生成。

## 实现约束

- Plan 模式只允许写入 Idiots Roadmap 的规划控制产物：`IDIOTS_ROADMAP.md`、`.idiotsroadmap/state.json`、`.idiotsroadmap/runtime/`、`.idiotsroadmap/archive/` 以及同目录临时候选文件。产品代码、普通项目文档、配置、依赖和 Git 状态仍必须只读。
- 若宿主只把“产品开发”设为只读，主 Skill 可直接写入上述规划控制产物；若宿主从系统层面禁止所有写操作，系统限制优先，Skill 不得绕过，只能先输出可校验候选状态，待 Plan 被用户确认且宿主解除只读后立即落盘并停止。
- Roadmap 支持三种落盘方式：`hook`、`direct` 和 `deferred-direct`。检测到明确的 hook 注入标记时只能由 hook 落盘；没有标记时由 Skill 使用便携式工具直接落盘；硬只读时使用延后直接落盘，避免重复写入。
- Proma Pi 默认使用 `direct` 或 `deferred-direct`，不得把 Claude/Codex 的 hook 事件、权限字段或 `ExitPlanMode` 当作运行前提。
- 便携式初始化必须能在目标项目尚无 `.idiotsroadmap/runtime/` 时完成首次落盘；成功后再安装项目本地运行工具，供后续 Start、Finish 和 Align 使用。
- `repository.githubMode` 使用 `connected`、`create-private`、`connect-existing` 或 `local-only`。新 Roadmap 必须记录；已有 V3 状态缺失时按未决定处理，下一次 Plan/Align 补齐，不阻断读取。
- Start 在首批获批后、领取开发任务前重新检查实际仓库。没有 Git 时由 AI 原地初始化、保护现有文件并建立串行基线；不得 stash、删除或覆盖用户改动。Git 身份缺失时只询问提交记录显示的名字和邮箱，不把命令交给用户。
- `create-private` 默认创建私人仓库；`connect-existing` 必须先获得仓库地址。账号未登录、仓库不兼容或外部操作需要授权时停止并给出一句可执行提示，不得退化成公开仓库或擅自覆盖远程历史。
- 创建 GitHub 仓库、添加 remote 和任何 push 都属于外部写入。只有用户选择对应方案或另行明确授权后才能执行；公开仓库必须再次单独确认，现有 `manual-after-final-acceptance` 推送策略保持不变。

- V3 使用项目内 revision 防止旧 Session 覆盖新状态；更新时必须校验 base revision，同一 revision 只能成功落盘一次。
- `.idiotsroadmap/state.json` 是项目事实源，至少包含目标、能力、里程碑、模块、接口合同、工作项、变更、证据、当前批次、接力信息与仓库状态。
- 模块按职责、数据所有权、变更耦合和依赖关系划分，不能机械等同于文件夹；接口必须记录提供方、使用方、版本、兼容性和证据可信度。
- 证据可信度使用 `verified`、`observed`、`declared`、`conflict` 或 `unknown`。旧计划和旧文档只能作为证据，不能自动视为事实。
- 已有项目首次运行时必须只读分析仓库并重建基线；重新分析只更新发生变化的部分，保留人工确认和已接受历史。
- 工作项使用稳定 ID；已接受内容不可改写。未来工作只保存目标、依赖和边界，不提前保存完整开发提示词；批准后由 Start Skill 根据最新状态即时编译。
- 当前批次包含稳定 `proposalId` 和批准门：`proposed`、`approved` 或 `not-required`。Finish 只能写入 `proposed`；只有用户明确批准才能写入 `approved` 并把对应工作变为可领取状态。
- 批准必须绑定 Roadmap revision、当前批次、工作项集合、用户可见结果和明确不做内容。上述内容变化后旧批准自动失效；纯技术实现变化不要求用户重复批准。
- Start Skill 只能领取 `approved` 批次中的 `ready` 工作项。任务领取使用项目内原子锁；已被领取的任务不得由其他 Session 重复开发。
- 新 Roadmap 必须为每个工作项规划 `session.branch`：串行与整合工作使用整合分支；独立并行工作使用稳定且互不重复的任务分支；共享目录并行使用 `null`。
- Start 领取后必须落实 Roadmap 的 Git 策略：串行任务进入整合分支；宿主托管 Worktree 验证隔离并在 detached 状态创建计划分支；手动 Worktree 创建计划分支和工作目录后停止，等待用户在该目录打开新 Session；共享目录并行不得切分支。
- 整合工作开始前必须确认所有依赖已经完成本地提交，再把独立任务分支合并到整合分支；共享目录策略跳过分支合并，只做统一检查和提交。冲突时停止自动合并并交给整合 Session 解决，不得覆盖任何一方。
- Finish Skill 必须以实际改动和验证结果为准更新进度；不得把 AI 的“已完成”声明当作用户验收。它借鉴 neat-s 的收尾原则，但不得依赖用户另外安装 neat-s，也不得创建 `docs/state/` 进度副本。
- Finish 必须在最终状态成功落盘后执行本地 Git 收口：确认当前分支与计划一致，拒绝夹带当前工作范围之外的改动，只暂存当前工作、必要项目文档和 Roadmap 状态，再创建英文提交。用户体验工作在用户通过后提交，纯技术工作在独立复核一致后提交。
- 共享目录的并行工作 Finish 不暂存、不提交；唯一串行整合工作统一提交该批结果。所有策略都不得由 Start 或 Finish 自动 push。
- Align Skill 先只读比较项目与 Roadmap，将差异分类为“计划过期”“项目偏离”“需要用户决定”或“没有计划”。只有事实明确时才自动纠偏；产品含义变化必须交给用户决定。
- 用户验收权限为 `user-experience`；技术验收权限为 `ai-review`。技术复核通过可以形成技术检查点，但不能自动启动下一工作项。
- 需求变化分为当前工作调整、待办、模块变化、接口变化和目标变化；只影响相关未完成工作。接口变化创建独立变更记录，目标变化归档旧 Roadmap。
- V1/V2 Roadmap 必须继续可读取；首次成功 V3 更新时迁移或归档，迁移失败保留旧文件并进入恢复提示，不做半迁移。
- Plan 状态无法确认时 hooks 必须静默；任何 `ExitPlanMode` 校验失败都必须拒绝，第二次失败只能停止自动纠错，不能放行退出 Plan。
- Roadmap 失败状态按 Session、目标、事件和 revision 隔离并设置过期时间，不得让旧失败次数影响新目标。
- 并行开发必须明确 `workspaceStrategy`：`codex-managed-worktree`、`claude-managed-worktree`、`manual-worktree` 或 `shared-directory`。
- 独立 worktree 策略必须记录共同基线；共享目录策略下并行 Session 不切分支、不暂存、不提交，统一由整合 Session 提交。
- 每个并行批次后紧接一个唯一串行整合批次；整合步骤必须等待本批所有步骤，不得用一个模糊整合步骤跨越多个批次。
- 所有路径必须从已确认的项目根目录解析；拒绝路径穿越和指向项目外的符号链接。
- 写入 Roadmap 使用同目录临时文件和原子重命名；校验失败不得覆盖旧文件。
- 新目标覆盖前归档旧 Roadmap；同一目标、能力切换或重新分析只改写相关未完成工作，已完成历史原样保留。
- 只有在共享契约已经确定、允许修改的文件范围可明确划分且并行步骤之间没有重叠时，才标记为并行；无法确定时必须使用串行。
- 路由、数据库结构、全局配置、依赖锁文件、权限安全、共享状态和公共设计系统等高冲突内容默认串行，除非 Roadmap 已先拆出并完成共享契约步骤。
- 同一并行批次默认不超过 3 个 Session；每个并行批次后必须安排一个串行整合步骤，等待全部并行步骤通过后再联调和验收。
- 宿主支持独立 worktree 时，并行 Session 优先各自隔离；只能共享同一工作目录时，并行 Session 不得切换分支或提交，统一由后续整合 Session 收口。
- Roadmap 开始时从干净基线创建一次整合分支；之后只有并行步骤新建独立子分支，串行步骤留在整合分支，并行结果验收通过后由串行整合步骤合并。
- 用户可体验工作只能在用户验收通过后提交；纯技术工作可在独立复核一致后建立技术检查点。并行子分支默认不推送，整个 Roadmap 最终验收通过且用户明确授权后才能推送整合分支。
- 未检测到 GitHub remote 时按 `repository.githubMode` 引导：`local-only` 不连接，`create-private` 或 `connect-existing` 在 Start 中按用户已选方案处理；不得自动登录、创建公开仓库或推送。
- 工作区存在未提交改动或状态未知时，开始并行前必须安排串行基线保护；不得擅自 stash、提交、覆盖或清理用户已有改动。
- Skill 和 hooks 不自动创建 Session、切换分支、创建 worktree、合并代码或进入未批准的下一任务。Start Skill 可在用户打开的新 Session 中领取并执行已批准任务；Finish Skill 只能收尾并提出下一批。
- hooks 缺少 Node.js 或遇到不支持的输入时应安全退出，不影响宿主正常工作。
- 密钥、token、用户私有路径和运行时缓存不得提交。

## 测试与发布

- 每次行为变更都必须补充或更新 `node:test`。
- 已有项目接管测试必须覆盖：无文档、过期文档、代码与计划冲突、部分实现、无测试、未提交改动、无 Git、多语言、旧新实现并存和增量重扫。
- 长链测试必须证明跨多个 Session 后目标、模块和接口不漂移，且用户文档不会随历史无限膨胀。
- 提交前运行 Skill、插件清单、marketplace、Roadmap 协议和全量测试验证。
- CI 覆盖 Windows、macOS、Linux 与 Node.js 18+。
- 不自动执行 `git push` 或发布；只有用户明确要求时才进行。

## 清理规则

- 临时测试目录由测试自身清理，不进入仓库。
- 本插件仓库不提交测试运行生成的用户 Roadmap、项目状态、`node_modules/`、覆盖率输出或 hook 临时文件。
- 过期黄金样例应更新或删除，不保留重复版本。
- 不保留逐步骤验收报告或同一事实的多份 Markdown 副本；技术证据进入机器状态或测试。
