export function buildPlanProtocol({ languageGroups, existingRoadmap, hasFrontend }) {
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

仓库检测：hasFrontend=${String(hasFrontend)}。完全不看代码且 hasFrontend=true 时，第一步必须先给可打开、可点击、可反馈的前端结果；后端准备不得成为更早的独立用户步骤。`;
}
