# Idiots Roadmap 全量审计报告

## 👋 先给完全不看代码的你

### 一句话结论

这个工具的方向没有问题，自己继续开发和测试也可以；但现在还不适合直接公开给别人安装。

原因不是“它完全不能用”，而是：

> 它已经会告诉 AI 应该守哪些规矩，但有几条规矩目前还只是写在纸上，程序不一定每次都拦得住。

### 现在已经有什么

- 它会把大计划拆成可以逐步验收的小任务。
- 它会告诉你哪些任务可以让多个 AI 对话同时做。
- 它会说明什么时候保存版本、什么时候不能上传到 GitHub。
- 项目现有检查可以正常跑完。

### 现在最需要修什么

先修三件事就够了：

1. **出错也不能乱跑：**计划没生成成功时，AI 仍然必须停在计划阶段。
2. **改计划不能弄丢进度：**你换一种验收方式，已经做完的步骤仍然要保留。
3. **多个 AI 不能互相踩文件：**Codex、Claude Code 和共用一个项目文件夹时，要分别采用合适的方法。

其他问题虽然也要修，但可以排在这三件事后面。

### 这次怎么验收这份报告

你只需要确认：

- 上面三件最重要的事，和我们接下来准备修的三个目标一致。
- 文档最后的“推荐修复路线”是先打地基，再做并行开发，最后统一检查。

确认这两点就够了。下面是留给后续开发 AI 使用的完整细节，你现在不需要全部看懂。

---

> 审计日期：2026-07-31  
> 审计方式：独立 `gpt-5.6-sol` 子 Agent，`xhigh` 推理强度，只读检查  
> 审计范围：Skill、hooks、Roadmap 协议、校验与落盘、插件清单、README、测试，以及 Codex、Claude Code、OpenCode 的实际使用场景

## 一、结论

当前版本适合作为内部测试版，不建议立即公开发布。

产品方向成立，主要问题不是“Roadmap 不会生成”，而是文档里声明的安全规则还没有全部变成程序真正能保证的行为。

发布前至少需要解决六个高优先级问题：

1. Roadmap 连续两次生成失败时，Claude Code 可能仍继续退出 Plan。
2. 用户更换能力范围后，“已完成步骤保持不变”在部分场景中无法成立。
3. 特殊符号链接目录可能导致程序先在项目外创建目录，再发现路径不安全。
4. 多 Session 并行规则没有真正区分 Codex Worktree、Claude Code Worktree 和共享目录三种情况。
5. “完全不看代码”目前只检查标签，验收文字仍可能要求用户看终端、日志或源代码。
6. README 中的 Codex 安装方法和公开 GitHub 安装地址目前无法完整复现。

当前检查结果：

- `npm.cmd test`：45 项，44 通过，1 项因 Windows 符号链接权限跳过。
- `npm.cmd run validate`：通过。
- 当前分支：`master`
- 当前提交：`28ed588 v0.9`
- 当前没有 Git remote。
- 审计过程没有修改、提交或推送项目文件。

## 二、高优先级问题与修复方案

### 1. 第二次校验失败可能继续退出 Plan

位置：`hooks/land-roadmap.mjs`

第一次 Roadmap 校验失败时，hook 会要求 AI 修正。但第二次仍失败时，当前逻辑可能允许 `ExitPlanMode` 继续执行。

用户影响：

- 文件没有成功生成；
- 用户却可能已经离开 Plan；
- 容易误以为 Skill 仍然守住了“只生成 Roadmap，不开始开发”的边界。

修复：

- 无论失败多少次，`ExitPlanMode` 都不能被自动放行。
- 第二次失败可以停止自动纠错，但必须继续留在 Plan。
- 缺少明确 Plan 状态时完全静默。
- 增加 Claude Code 真实 `ExitPlanMode` 测试。

### 2. 能力切换与已完成步骤保留互相冲突

位置：`hooks/lib/roadmap.mjs`

例如用户原来选择“能看 TypeScript”，已完成步骤使用代码差异验收；之后切换成“完全不看代码”：

- 系统要原样保留已完成步骤；
- 新能力又禁止任何代码验收；
- 整份 Roadmap 因旧步骤而无法通过。

步骤 ID 还与当前顺序强绑定，导致插入、删除或重新拆分步骤时难以保留完成步骤。

修复：

- 内部步骤 ID 不再代表显示顺序。
- 用户看到的编号单独保存。
- 新能力只约束未完成步骤。
- 已完成步骤保存内容、顺序、批次和依赖快照。
- Roadmap 增加版本号，防止旧 Session 覆盖新计划。

### 3. 路径安全检查顺序错误

位置：`hooks/lib/roadmap.mjs`

当前实现可能先创建 `.idiotsroadmap/archive`，之后才检查它是否通过符号链接指向项目外。

用户影响：

- 最终虽然显示拒绝写入；
- 但项目外可能已经产生目录。

修复：

- 创建任何目录前，先逐层检查父路径。
- Windows 使用 junction 测试，不再依赖容易被权限跳过的 symlink 测试。
- 写入过程增加并发锁和 Roadmap 版本检查。
- 补充写入失败、归档失败和并发写入测试。

### 4. 多 Session 与 Git 没有区分真实运行方式

位置：

- `hooks/lib/roadmap.mjs`
- `skills/idiots-roadmap/SKILL.md`
- `README.md`

当前协议同时要求：

- 并行步骤新建独立分支；
- 如果多个 Session 共享目录，又不能切分支或提交。

两条规则不能同时成立。

Codex、Claude Code 和普通共享目录需要三套不同策略：

- Codex 托管 Worktree；
- Claude Code 托管或命令行 Worktree；
- 多个 Session 共享同一个目录。

修复：

为每份 Roadmap 明确选择一种工作区策略：

```text
codex-managed-worktree
claude-managed-worktree
manual-worktree
shared-directory
```

同时保存：

- 所有并行 Session 共同基于哪个已确认版本；
- 每个 Session 位于哪个目录和分支；
- 哪一步负责最终整合；
- 失败后如何恢复；
- 最后如何清理临时 Worktree 和分支。

共享目录模式下：

- 并行 Session 不切分支；
- 不暂存；
- 不提交；
- 只修改互不重叠的文件；
- 最后的整合 Session 统一提交。

独立 Worktree 模式下：

- 每个 Session 使用独立目录和分支；
- 验收通过后提交；
- 整合 Session 合并已通过的结果。

### 5. “完全不看代码”可以被验收文字绕过

位置：`hooks/lib/roadmap.mjs`

当前只检查验收类型是否标记成 `code` 或 `diff`，没有检查实际文字。

以下内容仍可能通过：

- 打开终端运行测试；
- 查看日志；
- 阅读测试报告；
- 打开源代码文件；
- 查看 CI 或数据库控制台。

修复：

把验收能力变成结构化字段：

```yaml
requiresTerminal: false
requiresCode: false
requiresLogs: false
requiresTestReport: false
language: null
```

完全不看代码时必须全部为 false。能看代码时，只允许用户选择过的语言。

关键安全文字由程序模板生成，不再完全交给 AI 自由发挥。

### 6. 公开安装链路无法复现

位置：

- `README.md`
- `.agents/plugins/marketplace.json`
- `.codex-plugin/plugin.json`

问题：

- Codex README 中的安装命令与当前官方流程不完全一致。
- 本地仓库没有 Git remote。
- 本地默认分支是 `master`，marketplace 指向 `main`。
- marketplace 指向的公开 GitHub 仓库尚未从当前项目状态得到验证。
- 清单版本、提交版本和实际工作树不同步。

修复：

- 更新 Codex 安装说明，使用当前官方 `/plugins` 或 Plugins Directory。
- 建立真实 GitHub 仓库。
- 对齐默认分支、marketplace `ref`、版本号和 tag。
- 在全新 clone 中分别完成 Codex 和 Claude Code 的安装测试。
- 发布时使用明确 tag 或 commit，而不是未验证的浮动分支。

## 三、其他重要逻辑问题

### Roadmap 新建与更新状态不完整

需要明确：

- 没有旧 Roadmap 时不能执行 update。
- 相同目标不能无提示地按 new 重新归档。
- 不同目标必须归档旧文件。
- Roadmap 状态损坏时进入恢复流程。
- 两个 Session 同时更新时，旧版本不能覆盖新版本。

### 单次纠错状态容易互相污染

当前失败次数：

- 没有过期时间；
- 没有 Roadmap 版本；
- 没有目标标识；
- 缺少 Session ID 时都使用同一占位值；
- 多个 hook 可能互相影响。

应保存 Session、事件、目标、版本和过期时间，并使用原子写入。

### 文件范围只是提示，不是真正限制

当前 `files` 只告诉 AI“不要改其他文件”，没有阻止工具真正写入范围外路径。

短期应在 README 说明这只是提示约束。中长期可增加写入工具守卫。

### Git 状态可能过期或被 AI 写错

hook 会检测 Git，但最终 Roadmap metadata 仍由 AI 输出。

落盘前应再次读取真实 Git 状态，并覆盖或拒绝与真实状态不一致的字段。

每个开发步骤开始前也应重新检查，而不是一直使用计划生成时的快照。

### Git 规则过于强制

需要支持：

```text
never
optional-manual
manual-after-final-acceptance
```

不能因为项目存在 remote，就强制用户最后必须准备推送。

还需要支持：

- 切换到已有整合分支；
- Codex Worktree 的正常 detached 状态；
- 只在真正需要并行前处理 dirty 基线。

### Roadmap 标记可以产生歧义

目前需要进一步限制：

- OPTOUT 和 Roadmap 不能同时出现。
- BEGIN/END 各只能出现一次。
- section 不能重复。
- section 顺序必须固定。
- step 必须全部位于 steps 区域。
- 只读取宿主官方提供的计划字段，避免误识别引用示例。

### mock 与真实数据的对应关系不完整

当前只检查第一个 mock 后面是否存在真实 UI 集成。

应让每个 mock 明确声明由哪一步替换：

```yaml
replacedBy: step-05
```

不同项目分别使用：

- UI mock → 真实 UI
- CLI fixture → 真实输入输出
- report fixture → 真实报告
- backend fixture → 真实接口或输入输出

### 前端和语言检测可能误判

当前扫描：

- 不读取 `.gitignore`；
- 受目录顺序影响；
- 测试文件或旧 HTML 也可能被认为是现有前端；
- 大仓库可能超时。

建议优先使用 `git ls-files`，一次扫描同时判断语言和前端，并设置总体时间限制。

## 四、平台适配结论

### Codex

可以支持，但需要补齐：

- 当前官方安装方式；
- hook 信任流程；
- 插件需要新建任务才能加载的说明；
- Local 与 Worktree 的不同流程；
- detached HEAD；
- Worktree 在任务开始时选择，而不是提示词运行后自动变出来。

### Claude Code

与当前设计最接近，但需要补齐：

- `ExitPlanMode` 连续失败处理；
- `Stop` 的真实重入行为；
- `claude --worktree/-w`；
- Desktop Worktree；
- `worktree.baseRef`；
- subagent worktree isolation；
- 插件安装后的 reload 流程。

### OpenCode

不建议直接复用现有 `hooks.json`。

未来适配应单独实现：

1. 将 Skill 放入 OpenCode 能发现的位置。
2. 使用 OpenCode `question` tool 完成两轮选择。
3. 明确限制 Plan agent 的文件和命令权限。
4. 提供专用落盘工具，例如 `idiots_roadmap_land`。
5. 由该工具调用共享校验和写入代码。
6. 第一版只承诺手动 Git Worktree，不宣称宿主自动隔离。

保持 V1 暂不支持 OpenCode是合理决定。

## 五、建议补充的测试

### 宿主真实测试

- Codex marketplace 添加与安装。
- Codex `/plugins` 和 hook trust。
- Codex Local/Worktree。
- Claude marketplace、安装和 reload。
- Claude `ExitPlanMode` 与 Stop。
- Claude CLI/Desktop Worktree。
- Node 不可用或版本过低。

### Roadmap 状态测试

- update 时旧文件不存在。
- new 与旧目标相同。
- stored metadata 损坏。
- Roadmap 版本冲突。
- code-reader 切换 no-code。
- 已完成步骤位置、批次和依赖被修改。
- completed 状态回退。

### 安全测试

- `.idiotsroadmap` 指向外部 junction。
- `archive` 指向外部。
- 写入检查后路径被替换。
- 两个 Session 同时写 Roadmap。
- rename、copy、fsync 失败。
- 多个 BEGIN/END。
- OPTOUT 与 Roadmap 同时出现。
- 超大输入和 stdin 半包。

### 多 Session 与 Git 测试

- Codex detached Worktree。
- Claude `--worktree`。
- 共享目录并行。
- 分支已经存在。
- 分支已被其他 Worktree 使用。
- 并行 Session 基线不同。
- integration 不紧接并行批次。
- 后续批次漏写依赖。
- Git 状态在计划生成后变化。

### 用户能力测试

- no-code 中出现终端、日志、测试报告或源文件。
- code-reader 要求阅读未选择语言。
- custom 能力边界。
- guard 注释与相反自然语言同时出现。
- CLI/report mock 被错误要求 UI 验收。

### 测试方法升级

- 手写固定 golden Markdown，不全部依赖同一个 fixture 生成器。
- 属性测试。
- 模糊测试。
- mutation tests。
- 故障注入。
- 真实宿主 snapshot。
- 独立参考校验器。

## 六、未来优化方向

### 近期

1. 修复第二次 `ExitPlanMode` 放行。
2. 无法确认 Plan 时完全静默。
3. 稳定步骤 ID。
4. Roadmap revision。
5. 更新冲突检查。
6. 已完成步骤状态规则。
7. 能力切换只重写未完成步骤。
8. 严格 Roadmap 标记解析。
9. OPTOUT 唯一性。
10. stored metadata 独立保存。
11. symlink/junction 创建前检查。
12. Roadmap 写入锁。
13. 目录 fsync。
14. 正式 new/update 状态机。
15. 落盘前重新检测 Git。
16. 多种 pushPolicy。
17. workspaceStrategy。
18. baseCommit。
19. integration barrier。
20. 有限文件范围语法。
21. 结构化 no-code 验收。
22. code-reader 语言集合。
23. mock replacedBy。
24. 修正 Codex 安装说明。
25. Claude 独立 fallback。
26. 全新 clone 安装测试。
27. 版本、tag、manifest 对齐。
28. hook 诊断信息。
29. 向 AI 注入旧 Roadmap 最小状态。
30. 仓库扫描总体时间限制。

### 中期

31. Markdown 只负责展示，JSON 负责真实状态。
32. renderer 与 validator 共用结构化 AST。
33. 独立参考校验器。
34. 属性和模糊测试。
35. Mutation testing。
36. 三宿主 adapter interface。
37. Codex Worktree adapter。
38. Claude Worktree adapter。
39. 共享目录 adapter。
40. OpenCode 专用落盘工具。
41. Session 启动提示生成器。
42. Worktree 清理策略。
43. 分支冲突预检测。
44. 高冲突共享文件知识库。
45. 文件 ownership graph。
46. API/data contract 预拆分。
47. 并行收益与整合成本估算。
48. 并行数量动态限制。
49. 用户拒绝验收后的返工状态。
50. 能力范围可视化。
51. Roadmap 恢复向导。
52. 本地、永不推送、PR 等协作模式。
53. 自动生成 progress/session/git 区域。
54. 错误信息直接告诉用户下一步。
55. 宿主能力自动识别。
56. 插件版本兼容矩阵。
57. 本地诊断包。
58. 多语言验收语义检查。
59. 非前端项目验收模板。
60. 每步验收证据归档。

### 长期

61. 本地多 Session 编排器。
62. 自动创建宿主对应 Worktree Session。
63. 文件写入范围硬限制。
64. 自动阻止范围外 Edit/Write。
65. 自动分析依赖图和文件所有权。
66. 根据历史冲突调整并行计划。
67. 自动预测 integration 冲突。
68. accepted commit 和来源证明。
69. Roadmap revision 时间线。
70. 用户验收证据资产库。
71. 自动生成人话版改动影响。
72. 无代码用户视觉回归。
73. AI 自动制作验收演示。
74. 多模型交叉审查 Roadmap。
75. 并行 Session 结果自动对账。
76. GitHub PR 可选模式。
77. 将 CI 结果翻译成小白可理解的证据。
78. 失败 Session 自动重新排队。
79. 根据用户反馈重新拆分步骤。
80. 项目内能力偏好。
81. GitLab、Gitea、Bitbucket。
82. Monorepo ownership。
83. Submodule 与 sparse checkout。
84. 容器和远程开发环境。
85. 宿主 capability negotiation。
86. Roadmap 协议版本迁移。
87. 旧 Roadmap 自动升级。
88. 发布文件签名。
89. 插件兼容性自动巡检。
90. 真实项目匿名回归语料。

## 七、推荐修复路线

### 第一批：发布阻断

按顺序完成：

1. 第二次失败继续阻止退出 Plan。
2. 无法确认 Plan 时不运行。
3. 修复路径安全和并发写入。
4. 修正 Codex 安装说明和 marketplace。
5. 增加对应回归测试。

这批未完成前不发布。

### 第二批：Roadmap 状态机

先确定：

1. goal/action/revision。
2. stable ID。
3. completed 不变量。
4. capability migration。
5. 严格 envelope grammar。
6. stored metadata 格式。

契约确定后可以并行修改：

- validator；
- hooks；
- Skill/protocol；
- README；
- tests。

最后统一整合。

### 第三批：多宿主 Session

先定义 `workspaceStrategy`。

之后可以并行：

- Codex Worktree；
- Claude Code Worktree；
- shared-directory。

最后统一验证：

- base commit；
- integration barrier；
- merge；
- cleanup；
- final push。

### 第四批：用户能力和验收

- no-code 结构化验收；
- code-reader 语言集合；
- custom 能力；
- mock→real；
- 多语言语义检查。

### 第五批：真实发布

- Windows、macOS、Linux 全新 clone。
- Codex CLI/Desktop。
- Claude CLI/Desktop。
- Node 18/20/22。
- marketplace URL、ref、tag。
- 非程序员根据 README 完成一次安装和使用。

### 第六批：OpenCode

V1 稳定后单独开发，不在现有 hooks 中堆兼容分支。

## 八、官方资料

- [OpenAI Hooks](https://learn.chatgpt.com/docs/hooks)
- [OpenAI 插件打包](https://developers.openai.com/plugins/build/plugins)
- [Codex Plugins](https://learn.chatgpt.com/docs/plugins)
- [Codex Git Worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)
- [Codex 官方 Plan 模板](https://github.com/openai/codex/blob/main/codex-rs/collaboration-mode-templates/templates/plan.md)
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code Worktrees](https://code.claude.com/docs/en/worktrees)
- [Claude Code 插件安装](https://code.claude.com/docs/en/discover-plugins)
- [OpenCode Agents](https://opencode.ai/docs/agents)
- [OpenCode Skills](https://opencode.ai/docs/skills)
- [OpenCode Tools](https://opencode.ai/docs/tools)
- [OpenCode Plugins](https://opencode.ai/docs/plugins)
- [OpenCode CLI](https://opencode.ai/docs/cli)

## 最终判断

Idiots Roadmap 的用户定位和产品方向已经成立，问题集中在：

> 当前能生成一份看起来安全、清楚的 Roadmap，但程序还不能保证 AI 在真实宿主中一定严格按照这些规则执行。

优先修复发布阻断、状态机和三种 Session 工作方式，再继续增加功能。
