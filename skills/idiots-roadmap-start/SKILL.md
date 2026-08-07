---
name: idiots-roadmap-start
description: 在新的开发 Session 中安全继续 Idiots Roadmap 项目。显式运行 $idiots-roadmap-start、“继续 Roadmap”“开始下一轮”或“接着开发”时使用；自动读取项目规则、IDIOTS_ROADMAP.md 和 .idiotsroadmap/state.json，展示尚未批准的下一批结果卡，记录用户批准，原子领取一个未被其他 Session 占用的工作，并根据最新项目状态即时编译开发指令。用于 Codex 或 Claude Code 的非 Plan 开发 Session，不用于创建总计划。
---

# Idiots Roadmap Start

让空白开发 Session 自动接班。只执行用户已经批准的结果，不要求用户复制或维护长提示词。

## 进入项目

1. 以 `git rev-parse --show-toplevel` 确认项目根；非 Git 项目使用当前目录。不上探父目录或兄弟目录。
2. 读取项目根的 `AGENTS.md`、`CLAUDE.md`（存在时）、`IDIOTS_ROADMAP.md` 和 `.idiotsroadmap/state.json`。
3. 运行 `node .idiotsroadmap/runtime/roadmap-state.mjs validate`。
4. 缺少状态或本地 runtime 时停止。Plan 模式中改用 `$idiots-roadmap`；普通模式中提示用户进入 Plan 建立 Roadmap。
5. 完整读取同插件的 `../idiots-roadmap-finish/SKILL.md`，把它作为本 Session 的固定收尾协议。

## 检查批准门

- `current.workItemIds` 为空：目标已完成，停止。
- `current.approval` 缺失：按旧版状态处理为“尚未批准”，不得开发。
- `approval.status: proposed`：只用大白话展示结果卡，包括下一轮做什么、完成后能看到的 1–2 个结果、本轮不做什么、为什么现在做。等待用户明确回复“开始下一轮”或同义表达。
- 用户在本次调用中已经明确说“开始下一轮”，可直接视为批准；不得从沉默、“继续看看”或 AI 自己的判断推断批准。
- 收到明确批准后运行 `node .idiotsroadmap/runtime/roadmap-state.mjs approve`。
- 用户要求调整时不批准、不领取。小范围结果调整交给 `$idiots-roadmap-align`；目标变化回到 Plan 使用 `$idiots-roadmap`。

批准只确认用户可见结果和边界。技术实现方式不交给用户审核。

## 准备版本保护

批准后、领取任务前重新检查实际 Git 和远程状态，不盲信旧 Roadmap：

- 没有 Git：告诉用户“我先建立本地版本保护，不会上传”，然后在项目原地初始化 Git、使用 Roadmap 的整合分支并保护当前全部文件。不得 stash、删除、覆盖或清理用户改动。首批保持串行。
- Git 提交身份缺失：只询问“提交记录显示的名字和邮箱”，由 AI 完成配置和基线；不要让用户执行命令。
- `githubMode: local-only`：不连接远程，不重复询问。
- `githubMode: create-private`：检查本机 GitHub 登录；未登录时只提示用户完成登录并停止。已登录且授权有效时创建私人仓库并添加 remote，不得改成公开仓库。
- `githubMode: connect-existing`：没有地址时只询问仓库地址；先确认不会覆盖不兼容的远程历史，再添加 remote。
- `githubMode: connected`：保留现有 remote，不擅自替换。

初始化或连接后重新读取真实仓库状态，用 `.idiotsroadmap/next-state.json` 更新 `repository` 和 revision，再运行项目 runtime 的 `apply`。任何 push 仍遵守 `manual-after-final-acceptance`，本步骤不因创建或连接仓库而自动推送。

## 开始前快速对齐

只读检查当前 revision、Git 基线、工作区变化、相关模块、接口合同和允许修改范围。若发现以下情况，停止领取并使用 `$idiots-roadmap-align`：

- 项目事实与状态中的关键接口、模块或依赖明显不一致；
- 已批准的用户结果需要改变；
- 当前文件范围与另一个并行任务重叠；
- 共同基线不存在或工作区有无法归属的改动。

纯粹的内部实现细节变化不撤销用户批准。

## 原子领取任务

批准后运行 `node .idiotsroadmap/runtime/roadmap-state.mjs claim`。命令会从当前批准批次中原子领取一个 `ready` 工作。多个并行 Session 分别运行时会自动拿到不同任务。

- 记录命令返回的 `workItemId` 和 `claimId`。
- 没有可领取工作时停止，不重复开发 `in_progress` 工作。
- 只有用户明确说明原 Session 已中断时，才运行 `reclaim <work-item-id>`；不得自动抢占。

## 即时编译并开发

领取后才根据最新代码即时形成内部开发指令，至少包含：

- 当前工作结果、模块职责、接口合同、文件范围和依赖；
- 用户已批准的可见结果与本轮不做内容；
- 当前仓库策略和并行隔离规则；
- 只实现当前工作、运行必要检查、完成后执行 Finish 收尾并停止。

不要把完整技术提示词写入 Roadmap，也不要预写未来批次。完成当前工作后按 Finish Skill 收尾，不直接领取下一项。
