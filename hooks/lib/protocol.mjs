export function buildPlanProtocol({
  languageGroups,
  existingRoadmap,
  hasFrontend,
  repository,
  projectAnalysis,
}) {
  const languageOptions =
    languageGroups.length === 0
      ? "未检测到可稳定识别的代码语言，不额外添加代码阅读选项。"
      : languageGroups
          .map((group) => `- 能看 ${group.label} 基础代码（约 ${group.count} 个相关文件）`)
          .join("\n");
  const warning = existingRoadmap
    ? "\n选择与当前不同的能力范围时，只重写受影响的未完成工作；已接受历史和用户决定保持不变。"
    : "";

  return `IDIOTS ROADMAP V3 PLAN PROTOCOL
IDIOTS_ROADMAP_LANDING_MODE: hook

当前处于 Plan 模式。Idiots Roadmap 是项目接力系统，不是详细步骤生成器。

对同一目标尚未完成选择时，分两轮询问：
1. 启用 Idiots Roadmap / 本轮不启用。
2. 启用后询问能力范围：始终提供“完全不看代码”，最多两个仓库语言选项，并保留原生“其他”入口。
${languageOptions}${warning}

若只读检测显示尚未连接远程仓库，且现有 Roadmap 没有保存过 GitHub 选择，再追加一次大白话选择：
- 创建新的私人 GitHub 仓库（推荐：防止电脑损坏导致项目丢失）
- 暂时只保存在本机
- 连接已有 GitHub 仓库
只记录选择，不在 Plan 中登录、创建仓库、添加 remote 或推送。

不启用时正常完成计划，并在末尾加入 <!-- IDIOTS_ROADMAP:OPTOUT -->。

启用后必须使用 $idiots-roadmap 并完整读取 references/roadmap-protocol.md。先完成产品必要澄清，再建立 V3 状态。当前上下文带有 hook 落盘标记，因此最终回答只输出 V3 BEGIN/END 与 IR_STATE 状态块；不得同时运行 direct bootstrap。hook 将机器状态写入 .idiotsroadmap/state.json，并生成唯一用户文档 IDIOTS_ROADMAP.md。

项目来源：${projectAnalysis?.origin || "unknown"}。
只读项目摘要：${JSON.stringify(projectAnalysis || {})}

如果项目来源为 existing：
- 使用仓库工具继续检查代码、文档、配置、数据结构、测试和本地 Git 证据；hook 摘要只是线索，不是完整结论。
- 按职责、数据所有权、变更耦合和依赖关系拆模块，不按文件夹机械拆分。
- 重建提供方、使用方和接口合同；标记 verified、observed、declared、conflict 或 unknown。
- 代码与旧计划冲突时不要擅自选边。技术冲突安排 AI 复核；只有改变产品含义时才询问用户。
- 分清已验证完成、已实现未验证、开发中、仅规划、已替代和未知。
- 全程只读，不安装依赖、不修改产品文件、不联网。

Roadmap 规则：
- 当前批次只提出 1–3 个 planned 工作项，不保存完整 Session 提示词；未来工作只保留里程碑、目标、依赖和边界。
- repository.githubMode 必须记录 connected、create-private、connect-existing 或 local-only。没有本地 Git 时首批只能串行，并在结果卡说明 AI 会先建立本地版本保护且不会上传。
- 每个工作项必须规划 session.branch：串行和整合工作使用 repository.integrationBranch；独立并行工作使用唯一任务分支；shared-directory 并行使用 null。Start 实际落实分支，Finish 在验收与最终状态落盘后本地提交。
- 为当前批次生成 current.approval 结果卡，状态只能是 proposed；写清下一轮做什么、1–2 个可见结果、本轮不做什么和为什么现在做。
- 用户批准后由 $idiots-roadmap-start 在新 Session 读取最新项目、原子领取 ready 工作并即时编译开发指令。Plan 不得自行批准或开始开发。
- 当前 Session 完成后由 $idiots-roadmap-finish 核对真实结果、提出下一批并停止，绝不自动开发下一项。
- user-experience 只验收真实页面、操作、视觉或样例结果，最多两项。
- ai-review 不设置用户验收；优先独立复核 Agent，不可用时生成复核 Session。
- 并行必须有明确模块所有权、互不重叠文件、共同合同和紧随其后的唯一整合工作项。
- 保留 revision、原子写入、旧 Session 覆盖保护、路径安全和已完成历史不可变。

仓库事实：hasFrontend=${String(hasFrontend)}；repository=${JSON.stringify(repository || {})}。
完全不看代码且有前端时，当前最早的用户体验工作应尽快提供可打开、可点击的相关流程；演示数据必须标明，真实集成后需再次体验。

Roadmap 落盘后停止，不退出 Plan，不开始开发。`;
}
