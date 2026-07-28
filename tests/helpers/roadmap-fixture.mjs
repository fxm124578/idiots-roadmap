export function makeStep({
  id = "step-01",
  label = null,
  status = "pending",
  kind = "other",
  evidence = "report",
  data = "none",
  title = "产生一个可验收结果",
  visible = "你会看到一个明确、可复现的结果。",
  boundaries = "不实现本步骤以外的功能。",
  acceptance = ["打开结果并确认核心内容正确。"],
} = {}) {
  const displayLabel = label || String(Number(id.slice(-2)));
  return `<!-- IR_STEP ${JSON.stringify({ id, label: displayLabel, status, kind, evidence, data })} -->
**🧩 子步骤 ${displayLabel}：${title}**

<!-- IR_FIELD:prompt -->
📋 第 1 步 — 复制以下提示词发给开发 AI：

\`\`\`text
请只实现当前子步骤。

🎯 要求：
- 交付结果：${visible}
- 运行必要技术检查。
- 完成后停止并等待我的验收。
- 只有我明确回复通过，才能把本步骤标为 completed。

⚠️ 约束：不要实现当前子步骤以外的功能。

<!-- IR_GUARD:current-step-only,run-checks,stop-for-acceptance -->

【🚧 边界条件】
<!-- IR_FIELD:boundaries -->
- ${boundaries}

【✅ 验收标准】
<!-- IR_FIELD:acceptance -->
${acceptance.map((item) => `- ${item}`).join("\n")}
\`\`\`

<!-- IR_FIELD:checklist -->
☑️ 第 2 步 — 人工验收清单（${acceptance.length} 项）：
${acceptance.map((item) => `- [ ] ${item}`).join("\n")}

<!-- IR_FIELD:reply -->
💬 第 3 步 — 回复：\`${displayLabel} 通过，请继续。\`

<!-- IR_STEP_END -->`;
}

export function makeEnvelope({
  action = "new",
  capabilityMode = "no-code",
  capabilityDescription = "完全不看代码",
  goal = "完成一个可验收目标",
  language = "zh-CN",
  hasFrontend = false,
  steps = [makeStep()],
} = {}) {
  const metadata = {
    version: 1,
    action,
    capability: { mode: capabilityMode, description: capabilityDescription },
    goal,
    language,
    project: { hasFrontend },
  };
  const markdown = `# Idiots Roadmap：${goal}

<!-- IR_SECTION:goal -->
## 目标
${goal}

<!-- IR_SECTION:capability -->
## 能力范围
${capabilityDescription}

<!-- IR_SECTION:progress -->
## 进度
0/${steps.length} 步已完成。

<!-- IR_SECTION:usage -->
## 使用方法
复制当前步骤提示词给开发 AI；它停止后按验收条目检查，明确回复通过后再进行下一步。

<!-- IR_SECTION:steps -->
## 开发步骤

${steps.join("\n\n")}
`;
  return {
    metadata,
    markdown,
    text: `<!-- IDIOTS_ROADMAP:BEGIN ${JSON.stringify(metadata)} -->\n${markdown}<!-- IDIOTS_ROADMAP:END -->`,
  };
}
