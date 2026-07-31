# Idiots Roadmap 项目规则

## 产品边界

- V1 只支持 Codex 与 Claude Code，不实现 OpenCode、Hermes 或其他宿主适配。
- Skill 只在 Plan 模式提供 Roadmap 协议；非 Plan 模式必须静默。
- 自动化只负责询问、生成、校验和落盘 `IDIOTS_ROADMAP.md`，不得批准计划、开始开发或持续监听反馈。
- 不调用外部 API、额外模型或网络服务，不在全局位置保存用户能力。

## 文档与交互

- 项目文档默认使用中文；代码标识符、协议字段和命令使用英文。
- `README.md` 中文优先；生成的 Roadmap 跟随当前对话语言。
- 面向不会开发的用户解释“为什么”和“对用户的影响”，避免只描述实现。
- 用户验收每步最多两项；无代码模式不得要求查看代码、终端、日志或测试报告。
- 无代码模式的验收文件必须先提供一段“30 秒看懂”的口语化入口，直接说明本步改了什么、用户只看哪里、看到什么算通过；技术名词和完整证据放在后面，不得挡在验收入口前。
- Roadmap 必须用用户能理解的方式标明开发批次、串行或并行 Session、前置依赖和允许修改的文件范围。
- 并行能力面向“多个开发 Session 同时操作项目”；分支或 worktree 只作为开发 AI 的隔离手段，不增加用户必须执行的 Git 操作。
- Roadmap 必须只读检测并显示本地 Git、工作区状态、远程仓库提供方、整合分支和推送策略；不得把 GitHub 连接作为并行开发的前提。

## 目录职责

- `skills/idiots-roadmap/`：跨宿主共享 Skill，只存放代理执行所需内容。
- `hooks/`：Codex 与 Claude Code 共用 hook 配置和零依赖 Node.js 脚本。
- `.codex-plugin/`：Codex 插件清单。
- `.claude-plugin/`：Claude Code 插件清单。
- `.agents/plugins/`：Codex GitHub marketplace 清单。
- `.claude-plugin/marketplace.json`：Claude Code GitHub marketplace 清单。
- `tests/`：`node:test` 测试、fixture 与黄金样例。
- `.github/workflows/`：跨平台 CI。
- `docs/verification/`：写给不看代码用户的阶段验收说明；每份文件先给“30 秒看懂”和最多两项验收，再把技术证据放到后面。
- 根目录文档只放用户需要的项目说明、许可和贡献规则。

## 命名与格式

- 文件与目录优先使用小写 kebab-case；宿主规定的固定文件名除外。
- JavaScript 使用 ESM `.mjs`，仅依赖 Node.js 18+ 标准库。
- JSON 使用 2 空格缩进并以换行结尾。
- 内部 Roadmap 协议字段使用稳定英文名，用户可见内容按会话语言生成。

## 实现约束

- 下一版 Roadmap 使用项目内 revision 防止旧 Session 覆盖新计划；更新时必须校验 base revision，同一 revision 只能成功落盘一次。
- 步骤内部 ID 是稳定身份，不再代表当前顺序；删除步骤后不得复用旧 ID，用户可见编号与内部 ID 分离。
- 能力切换只约束未完成步骤；已完成步骤保留原文、原能力范围和原验收结果，不因新能力被重写。
- V1 Roadmap 必须继续可读取；首次成功更新时迁移到新状态模型，迁移失败保留旧文件并进入恢复提示，不做半迁移。
- Plan 状态无法确认时 hooks 必须静默；任何 `ExitPlanMode` 校验失败都必须拒绝，第二次失败只能停止自动纠错，不能放行退出 Plan。
- Roadmap 失败状态按 Session、目标、事件和 revision 隔离并设置过期时间，不得让旧失败次数影响新目标。
- 并行开发必须明确 `workspaceStrategy`：`codex-managed-worktree`、`claude-managed-worktree`、`manual-worktree` 或 `shared-directory`。
- 独立 worktree 策略必须记录共同基线；共享目录策略下并行 Session 不切分支、不暂存、不提交，统一由整合 Session 提交。
- 每个并行批次后紧接一个唯一串行整合批次；整合步骤必须等待本批所有步骤，不得用一个模糊整合步骤跨越多个批次。
- 所有路径必须从已确认的项目根目录解析；拒绝路径穿越和指向项目外的符号链接。
- 写入 Roadmap 使用同目录临时文件和原子重命名；校验失败不得覆盖旧文件。
- 新目标覆盖前归档旧 Roadmap；同一目标或能力切换只改写未完成步骤，已完成步骤原样保留。
- 只有在共享契约已经确定、允许修改的文件范围可明确划分且并行步骤之间没有重叠时，才标记为并行；无法确定时必须使用串行。
- 路由、数据库结构、全局配置、依赖锁文件、权限安全、共享状态和公共设计系统等高冲突内容默认串行，除非 Roadmap 已先拆出并完成共享契约步骤。
- 同一并行批次默认不超过 3 个 Session；每个并行批次后必须安排一个串行整合步骤，等待全部并行步骤通过后再联调和验收。
- 宿主支持独立 worktree 时，并行 Session 优先各自隔离；只能共享同一工作目录时，并行 Session 不得切换分支或提交，统一由后续整合 Session 收口。
- Roadmap 开始时从干净基线创建一次整合分支；之后只有并行步骤新建独立子分支，串行步骤留在整合分支，并行结果验收通过后由串行整合步骤合并。
- 每个开发步骤只能在用户验收通过后提交；并行子分支默认不推送，整个 Roadmap 最终验收通过且用户明确授权后才能推送整合分支。
- 未检测到 GitHub remote 时只显示“未连接”，不自动创建仓库、添加 remote 或登录；用户明确需要云端同步或协作时才安排连接步骤。
- 工作区存在未提交改动或状态未知时，开始并行前必须安排串行基线保护；不得擅自 stash、提交、覆盖或清理用户已有改动。
- Skill 和 hooks 只生成并行编排与隔离提示，不自动创建 Session、切换分支、创建 worktree 或合并代码。
- hooks 缺少 Node.js 或遇到不支持的输入时应安全退出，不影响宿主正常工作。
- 密钥、token、用户私有路径和运行时缓存不得提交。

## 测试与发布

- 每次行为变更都必须补充或更新 `node:test`。
- 提交前运行 Skill、插件清单、marketplace、Roadmap 协议和全量测试验证。
- CI 覆盖 Windows、macOS、Linux 与 Node.js 18+。
- 不自动执行 `git push` 或发布；只有用户明确要求时才进行。

## 清理规则

- 临时测试目录由测试自身清理，不进入仓库。
- 不提交 `node_modules/`、覆盖率输出、hook 临时文件或生成的用户 Roadmap。
- 过期黄金样例应更新或删除，不保留重复版本。
