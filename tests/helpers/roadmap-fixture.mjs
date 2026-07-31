export function makeStep({
  id = "step-01",
  label = null,
  displayOrder = undefined,
  status = "pending",
  createdUnderCapability = undefined,
  kind = "other",
  evidence = "report",
  data = "none",
  batch = null,
  execution = "serial",
  dependsOn = [],
  files = null,
  parallelWith = [],
  gitAction = null,
  branch = null,
  push = "none",
  title = "产生一个可验收结果",
  visible = "你会看到一个明确、可复现的结果。",
  boundaries = "不实现本步骤以外的功能。",
  acceptance = ["打开结果并确认核心内容正确。"],
} = {}) {
  const numericSuffix = id.match(/(\d+)$/u)?.[1];
  const displayLabel = label || (numericSuffix ? String(Number(numericSuffix)) : id);
  const executionBatch = batch ?? (numericSuffix ? Number(numericSuffix) : 1);
  const fileScopes = files || [`work/${id}/**`];
  const resolvedGitAction = gitAction || (execution === "parallel" ? "create-branch" : "stay");
  const resolvedBranch = branch || (execution === "parallel" ? `ir/${id}` : "ir/roadmap");
  const sharedDirectoryStep = execution === "parallel" && resolvedGitAction === "stay";
  const waitingFor = dependsOn.length > 0 ? dependsOn.join("、") : "无";
  const sessionLabel =
    execution === "parallel"
      ? `🔀 并行 Session｜第 ${executionBatch} 批｜可与：${parallelWith.join("、")}｜等待：${waitingFor}｜文件范围：${fileScopes.join("、")}`
      : `➡️ 串行 Session｜第 ${executionBatch} 批｜等待：${waitingFor}｜文件范围：${fileScopes.join("、")}`;
  const gitActionText = {
    stay: "继续使用整合分支",
    "create-integration-branch": "从当前干净基线新建整合分支",
    "create-branch": "新建独立分支/worktree",
    "merge-branches": "合并已通过的并行分支",
    initialize: "初始化本地 Git 并建立基线",
    "prepare-baseline": "保护现有改动并建立干净基线",
  }[resolvedGitAction];
  const pushText = push === "none" ? "本步不推送" : "整合验收通过且你明确同意后才推送";
  const gitLabel = `${resolvedGitAction === "merge-branches" ? "🔗" : "🌿"} Git｜${gitActionText}：${resolvedBranch}｜${sharedDirectoryStep ? "本 Session 不提交" : "验收通过后提交"}｜${pushText}`;
  const sessionSafety =
    sharedDirectoryStep
      ? "多个 Session 共用目录：不要切换分支、暂存或提交，只修改声明范围，由整合 Session 统一收口。"
      : execution === "parallel"
      ? "宿主支持独立 worktree 时优先使用；多个 Session 共享目录时不要切换分支、暂存或提交，由整合 Session 统一收口。"
      : "开始前确认所有前置步骤已经通过；不要改动其他未完成 Session 的工作。";
  return `<!-- IR_STEP ${JSON.stringify({
    id,
    label: displayLabel,
    ...(displayOrder === undefined ? {} : { displayOrder }),
    status,
    ...(createdUnderCapability === undefined ? {} : { createdUnderCapability }),
    kind,
    evidence,
    data,
    batch: executionBatch,
    execution,
    dependsOn,
    files: fileScopes,
    gitAction: resolvedGitAction,
    branch: resolvedBranch,
    push,
  })} -->
**🧩 子步骤 ${displayLabel}：${title}**

<!-- IR_FIELD:session -->
${sessionLabel}

<!-- IR_FIELD:git -->
${gitLabel}

<!-- IR_FIELD:prompt -->
📋 第 1 步 — 复制以下提示词发给开发 AI：

\`\`\`text
请只实现当前子步骤。

🎯 要求：
- 交付结果：${visible}
- 只修改这些文件或目录：${fileScopes.join("、")}。
- 若发现需要改动范围外文件或与其他 Session 冲突，立即停止并说明，不要自行扩大范围。
- ${sessionSafety}
- Git 动作：${gitActionText}，目标分支为 ${resolvedBranch}。
- 保留用户已有改动；不要擅自 stash、覆盖、清理或把范围外改动带进提交。
- ${sharedDirectoryStep ? "本 Session 即使验收通过也不提交；只把结果留给唯一整合 Session 统一检查和提交。" : `在我验收通过前不要提交；收到“${displayLabel} 通过，请继续。”后，只提交当前文件范围。`}
- ${push === "none" ? "本步骤禁止推送远程。" : "只有整合验收通过且我再次明确同意后才能推送。"}
- 运行必要技术检查。
- 完成后停止并等待我的验收。
- 只有我明确回复通过，才能把本步骤标为 completed。

⚠️ 约束：不要实现当前子步骤以外的功能。

<!-- IR_GUARD:current-step-only,run-checks,stop-for-acceptance -->
<!-- IR_SESSION_GUARD:file-scope,no-cross-session-edits,stop-on-conflict -->
<!-- IR_GIT_GUARD:commit-after-acceptance,no-auto-push,preserve-user-changes -->

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

function stepMetadata(step) {
  const match = step.match(/<!--\s*IR_STEP\s+(\{[^\r\n]*\})\s*-->/);
  return match ? JSON.parse(match[1]) : null;
}

function makeSessionSummary(steps) {
  const groups = new Map();
  for (const step of steps) {
    const metadata = stepMetadata(step);
    if (!metadata) continue;
    if (!groups.has(metadata.batch)) groups.set(metadata.batch, []);
    groups.get(metadata.batch).push(metadata);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([batch, members]) => {
      const labels = members.map((member) => `子步骤 ${member.label}`).join("、");
      const mode = members.length > 1 ? "可同时开启多个 Session" : "串行";
      return `- 第 ${batch} 批（${mode}）：${labels}`;
    })
    .join("\n");
}

export function makeEnvelope({
  version = 1,
  roadmapId = undefined,
  revision = undefined,
  baseRevision = undefined,
  action = "new",
  capabilityMode = "no-code",
  capabilityDescription = "完全不看代码",
  capabilityLanguages = undefined,
  goal = "完成一个可验收目标",
  language = "zh-CN",
  hasFrontend = false,
  isGitRepo = true,
  workingTree = "clean",
  currentBranch = undefined,
  remoteProvider = "none",
  remoteName = null,
  integrationBranch = "ir/roadmap",
  workspaceStrategy = undefined,
  baseCommit = undefined,
  steps = [makeStep()],
} = {}) {
  const resolvedCurrentBranch =
    currentBranch === undefined ? (isGitRepo ? integrationBranch : null) : currentBranch;
  const metadata = {
    version,
    ...(version === 2
      ? {
          roadmapId: roadmapId || "rm_fixture0001",
          revision: revision ?? 1,
          baseRevision: baseRevision ?? null,
        }
      : {}),
    action,
    capability: {
      mode: capabilityMode,
      description: capabilityDescription,
      ...(capabilityLanguages === undefined ? {} : { languages: capabilityLanguages }),
    },
    goal,
    language,
    project: { hasFrontend },
    repository: {
      isGitRepo,
      workingTree,
      currentBranch: resolvedCurrentBranch,
      remoteProvider,
      remoteName,
      integrationBranch,
      pushPolicy: "manual-after-final-acceptance",
      ...(workspaceStrategy === undefined ? {} : { workspaceStrategy }),
      ...(baseCommit === undefined ? {} : { baseCommit }),
    },
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
按批次开启开发 Session；同一并行批次可以同时复制各自提示词。每个 Session 停止后按验收条目检查，全部通过后再进入下一批。

<!-- IR_SECTION:git -->
## Git 状态
- 本地 Git：${isGitRepo ? "已启用" : "尚未初始化"}
- 工作区：${workingTree}
- 当前分支：${resolvedCurrentBranch || "detached/未知"}
- GitHub：${remoteProvider === "github" ? `已连接（${remoteName}）` : remoteProvider === "none" ? "未连接（不影响本地并行）" : `连接了其他远程（${remoteName}）`}
- 整合分支：${integrationBranch}
- 提交时机：每个步骤验收通过后
- 推送时机：整合验收通过且用户明确同意后；没有远程仓库时不推送

<!-- IR_SECTION:sessions -->
## Session 安排
${makeSessionSummary(steps)}

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
