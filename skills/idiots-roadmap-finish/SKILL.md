---
name: idiots-roadmap-finish
description: 收尾当前 Idiots Roadmap 开发工作并建立可靠接力。显式运行 $idiots-roadmap-finish、“收尾”“这一步做完了”“更新 Roadmap 进度”或通过 idiots-roadmap-start 开始的任务完成时使用；核对实际改动、运行技术检查、同步必要项目文档、处理用户体验验收、更新唯一项目状态，并只提出下一批用户结果。也用于中断 Session 的补收尾，不自动批准或开发下一批。
---

# Idiots Roadmap Finish

把当前 Session 的真实结果收干净，再提出下一批。借鉴 neat-s 的“核对事实、精简文档、留下接力”原则，但不依赖 neat-s，也不创建第二套进度文档。

## 确认当前工作

1. 确认项目根并读取项目规则、`IDIOTS_ROADMAP.md`、`.idiotsroadmap/state.json`。
2. 运行状态校验，确认 revision、当前 `workItemId` 和 `claimId`。没有领取记录时根据本 Session 实际范围谨慎匹配；无法唯一确认就停止。
3. 只处理当前工作及其必要文档，不顺手开发下一项。

## 核对真实结果

- 检查实际改动、允许文件范围、模块边界和接口合同。
- 运行项目已有的必要测试、lint、build 或最小冒烟检查。
- 宿主支持独立子 Agent 时，让它只读复核当前结果；主 Agent 对比开发结论与复核结论。不能独立复核时进行第二遍针对性检查，必要时把工作标为需要复核 Session。
- 技术分歧先由 AI 修正，不把代码、日志或测试报告扔给不看代码用户。
- AI 的“已完成”声明不是用户验收证据。

## 同步必要文档

只更新本次改动真正影响的 README、架构、接口、运行说明或项目规则：

- 合并或修正旧内容，不追加会话流水账。
- `AGENTS.md` / `CLAUDE.md` 只保存以后写代码必须遵守的规则。
- 不创建 `docs/state/current.md`、`next.md`、`sessions.md` 或逐步骤验收报告。
- 项目进度只写入 `.idiotsroadmap/state.json`，用户视图只保留 `IDIOTS_ROADMAP.md`。

## 完成当前工作

### 用户可体验工作

技术检查一致后，把当前工作更新为 `awaiting_user`，清空旧版 `session.prompt`，通过候选状态执行 `apply`，然后只展示 1–2 个真实体验项并等待。

用户明确表示当前结果通过后，才标记为 `accepted`。未通过时保持当前工作，记录大白话反馈并只修当前结果。

### 纯技术工作

独立复核一致后标记为 `technical_verified`；存在分歧时标记阻塞或需要复核，不得假装完成。

按项目 Git 规则处理提交。用户可体验工作只能在体验通过后提交；纯技术工作只能在复核一致后形成检查点；不得自动推送。

## 提出下一批

当前工作真正结束后重新计算依赖，只展开下一批 1–3 个工作项：

- 工作项保持 `planned`，不保存完整开发提示词。
- 写入新的 `current.approval`，状态必须是 `proposed`。
- 结果卡只包含：下一轮做什么、完成后用户能看到的 1–2 个结果、本轮不做什么、为什么现在做。
- 未来批次继续只保留骨架。
- 没有后续工作时将 `current.workItemIds` 设为空、`current.approval` 设为空。

把候选状态写入 `.idiotsroadmap/next-state.json`，再运行 `node .idiotsroadmap/runtime/roadmap-state.mjs apply .idiotsroadmap/next-state.json`。成功后临时文件会删除，Roadmap 会重新渲染。

## 记录下一批批准

Finish 展示下一轮建议后停止，不自行批准。若用户随后明确回复“开始下一轮”，运行 `node .idiotsroadmap/runtime/roadmap-state.mjs approve`。

只记录批准，然后停止。不要在当前 Session 开始下一批；用户仍需打开新的 Session 运行 `$idiots-roadmap-start`。

