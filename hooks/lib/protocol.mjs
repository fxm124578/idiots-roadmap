export function buildPlanProtocol({ languageGroups, existingRoadmap, hasFrontend, repository }) {
  const languageOptions =
    languageGroups.length === 0
      ? "未检测到可稳定识别的代码语言，不额外添加代码阅读选项。"
      : languageGroups
          .map((group) => `- 能看 ${group.label} 基础代码（仓库检测到约 ${group.count} 个相关文件）`)
          .join("\n");

  const warning = existingRoadmap
    ? "\n第二轮问题必须原样附带：选择与当前不同的能力范围，会重写全部未完成步骤；已完成步骤保持不变。"
    : "";

  return `IDIOTS ROADMAP PLAN PROTOCOL

当前处于 Plan 模式。为这个新计划目标执行 Idiots Roadmap 两轮选择；如果当前对话已经对同一目标完成选择，不要重复询问。

第一轮只能询问：
1. 启用 Idiots Roadmap
2. 本轮不启用

不启用：正常完成技术计划，在最终回答末尾加入 <!-- IDIOTS_ROADMAP:OPTOUT -->，不要生成 Roadmap。

启用后再进行第二轮能力询问。始终提供“完全不看代码”，再提供最多两个仓库语言选项，并保留宿主原生“其他”入口：
${languageOptions}${warning}

优先使用原生 Plan 问题组件（Codex request_user_input 或 Claude AskUserQuestion）；不可用时才纯文本逐轮询问。Roadmap 选择完成后，可继续正常的需求澄清。

生成时必须使用已安装的 $idiots-roadmap Skill，并完整读取它的 references/roadmap-protocol.md。最终回答必须包含完整 BEGIN/END 标记块。Roadmap 落盘后停止，不退出 Plan，不开始开发。

仓库检测：hasFrontend=${String(hasFrontend)}。完全不看代码且 hasFrontend=true 时，第一步必须先给可打开、可点击、可反馈的前端结果；后端准备不得成为更早的独立用户步骤。

计划包含并行批次时，必须根据当前宿主和实际工作目录选择一种 workspaceStrategy，并写入 Roadmap：
- Codex 已为每个任务提供独立 Worktree：codex-managed-worktree。
- Claude Code CLI 使用 --worktree、Desktop 自动隔离或当前已在独立 Worktree：claude-managed-worktree。
- 宿主没有托管隔离，但开发 AI 能从已验收基线安全创建 Git Worktree：manual-worktree。
- 多个 Session 明确共用同一项目目录且文件范围互不重叠：shared-directory。
无法确认隔离方式、共同 baseCommit 或文件范围时改为串行，不要猜测。Skill 不会自动创建 Session、分支或 Worktree。shared-directory 的并行 Session 不得切分支、暂存或提交，由唯一整合 Session 统一收口。

Git 只读检测：${JSON.stringify(repository || {
    isGitRepo: false,
    workingTree: "unknown",
    currentBranch: null,
    remoteProvider: "none",
    remoteName: null,
  })}。把此状态写入 Roadmap；不要为了检测或连接 GitHub 修改仓库，也不要联网。`;
}
