# 🗺️ Idiots Roadmap

> 新开一个空白 AI 对话，它能不能自己找到项目进度、接上正确任务，还不替你决定产品方向？

<div align="center">

🧭 **Plan 模式锁定项目主轴**<br>
🙋 **人只批准下一轮要得到什么**<br>
🔁 **新 Session 自动读取、领取、开发和收尾**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Codex%20|%20Claude%20Code%20|%20Proma%20Pi-blue)]()
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933)](https://nodejs.org/)
[![Skills](https://img.shields.io/badge/Skills-4-orange)]()

</div>

---

## 🎯 Idiots Roadmap 是什么

Idiots Roadmap 是一组为长期 AI 开发设计的项目接力 Skill。

它不把未来几个月的提示词一次写死，也不要求每个新 Session 猜项目做到了哪里。它只固定长期不会轻易变化的内容：

- 最终要做成什么；
- 各模块分别负责什么；
- 模块之间怎样对接；
- 当前最值得做出的用户结果；
- 哪些结果已经由用户批准。

用户只看项目根目录的 `IDIOTS_ROADMAP.md`。完整模块、接口、证据、领取状态和历史保存在 `.idiotsroadmap/state.json`，不需要人手工维护。

### 模拟输出

```markdown
## 👀 下一轮建议

让个人清单真正可以保存。

完成后你会：
- 可以新增并完成一个清单项目。
- 刷新页面后，刚才的内容仍然存在。

这轮不会做：
- 多人协作。
- 提醒通知。

为什么现在做：列表页面已经可以打开，保存是最短的完整使用流程。

符合你的需求就回复：`开始下一轮`。
想调整时直接说：`调整：……`。
```

用户批准的是“下一轮会得到什么”，不是 AI 的代码方案。

Roadmap 也会直接显示版本保护状态：

```markdown
## 版本保护

- 本地版本保护：尚未启用；第一轮开始前由 AI 建立，不需要你执行命令，也不会上传网络。
- GitHub 备份：已选择创建私人仓库；AI 会在开发前检查登录状态并引导连接，不会创建公开仓库。
```

---

## 🧩 四个 Skill 怎样分工

| Skill | 角色 | 负责什么 |
|---|---|---|
| `$idiots-roadmap` | 总规划师 | 只在 Plan 模式建立目标、模块、接口、里程碑和第一张结果卡 |
| `$idiots-roadmap-start` | 接力员 | 在空白开发 Session 自动读取状态、记录批准、领取任务并开始开发 |
| `$idiots-roadmap-finish` | 收尾员 | 核对实际结果、运行检查、同步必要文档、更新进度并提出下一批 |
| `$idiots-roadmap-align` | 对齐员 | 比较项目和计划，判断应该改计划、修项目，还是让用户做产品决定 |

日常只需要记住两个入口：

```text
$idiots-roadmap
$idiots-roadmap-start
```

通过 Start 开始的开发会带上 Finish 收尾协议。Finish 也可以在中断或手动开发后单独运行；Align 通常由 AI 发现明显偏移时使用。

从 `2.2.0` 开始，Git 接力也进入同一流程：Roadmap 预先规划任务分支，Start 实际创建或进入分支/Worktree，Finish 在验收和最终状态落盘后创建本地提交。并行分支由后续整合任务合并；共享目录并行统一由整合 Session 提交。任何 push 仍需用户明确授权。

---

## 🔁 一次完整开发怎么走

```text
进入 Plan
   ↓
$idiots-roadmap 建立主轴和下一轮建议
   ↓
用户批准“下一轮会得到什么”
   ↓
新建开发 Session，运行 $idiots-roadmap-start
   ↓
Start 读取最新项目并原子领取一个任务
   ↓
AI 即时生成技术做法并开发
   ↓
Finish 核对结果、更新进度、提出下一轮
   ↓
停止，等待用户批准和打开新 Session
```

Start 不会直接执行上一轮留下的旧长提示词。详细技术指令是在领取任务后，根据用户已经批准的结果和项目最新状态即时生成的。

---

## ✅ 批准状态写在哪里

批准状态保存在 `.idiotsroadmap/state.json`，同时渲染到 `IDIOTS_ROADMAP.md`。

```text
Finish 提出下一轮
        ↓
proposed：等待用户批准
        ↓
用户明确说“开始下一轮”
        ↓
approved：允许新 Session 领取
        ↓
Start 原子领取
        ↓
in_progress：正在开发
```

用户可以在两个位置批准：

1. Finish 展示下一轮建议后直接回复“开始下一轮”。它只记录批准，不在当前 Session 开发下一项。
2. 没有当场批准时，在新 Session 运行 Start。Start 先展示同一张结果卡，收到批准后才领取任务。

沉默、AI 自己认为合理、或者“先看看”都不算批准。

只要下一批的用户结果、演示/真实数据、体验验收或明确不做内容发生变化，旧批准就失效。内部技术做法变化不要求用户重复批准。

---

## 👋 完全不看代码怎么用

用户只负责三件事：

1. 判断下一轮结果是不是自己想要的；
2. 真正打开产品，体验最多两项结果；
3. 需要继续时打开新的 Session。

代码、接口、迁移、测试和安全检查交给开发 AI 与独立复核 AI。它们意见一致时只显示一句结论；有分歧时先由 AI 解决，不让用户充当技术裁判。

不会再出现这些伪人工验收：

- “查看测试报告是否通过”；
- “确认数据库迁移已经完成”；
- “确认 AI 输出了已完成”。

---

## 🧭 接管已有项目

在已经开发了一部分的项目中，`$idiots-roadmap-align` 会先只读分析：

- 页面、路由、API 和共享类型；
- 数据库、迁移、存储和配置；
- 测试、fixture 和可运行证据；
- README、旧计划和项目规则；
- 本地 Git 状态与近期相关历史。

它不会把文件夹机械当成模块，而是按职责、数据归属、变更关系和依赖拆分。

发现不一致时分四类处理：

| 情况 | 处理方式 |
|---|---|
| 项目正确前进，计划过期 | 更新计划和证据 |
| 项目违反已确定要求 | 保留计划，新增修复工作 |
| 两种方向都可能合理 | 用大白话让用户选产品结果 |
| 没有 Roadmap | 在 Plan 模式分析项目并建立第一份基线 |

没有实际差异时只更新证据，不重排路线，也不让用户重新批准。

---

## 🔀 多个 Session 同时开发

只有满足以下条件才会并行：

- 共享接口已经确定；
- 文件范围互不重叠；
- 所有 Session 基于同一个版本；
- 并行后紧跟一个整合 Session；
- 同一批最多三个 Session。

用户批准一次整个批次，然后分别打开多个 Session，在每个 Session 运行：

```text
$idiots-roadmap-start
```

每个 Start 会通过项目锁自动领取不同任务。已经被领取的任务不会被另一个 Session 重复开发。

Roadmap 根据宿主选择 Codex Worktree、Claude Code Worktree、手动 Worktree或共享目录。无法确认隔离与文件边界时自动改为串行。

---

## 🧹 Finish 会不会生成一堆文档

不会。

Finish 借鉴 `neat-s` 的收尾理念：核对真实改动、修正文档、删掉过期说法、给下一 Session 留下可靠状态。但它不会依赖用户安装 `neat-s`，也不会创建 `docs/state/current.md`、`next.md`、`sessions.md` 或逐步骤验收报告。

进度始终只有两份来源：

- `IDIOTS_ROADMAP.md`：给人看；
- `.idiotsroadmap/state.json`：给 AI 和状态工具使用。

正式 README、接口和架构文档只在本次功能真的影响它们时更新。

---

## 🔄 中途改需求会怎样

- 当前结果的小调整：只修改当前工作；
- 不着急的新想法：放入待办，不打断现在；
- 模块内部变化：只重排相关未完成工作；
- 接口变化：标出提供方、使用方和整合关卡；
- 总目标变化：回到 Plan，归档旧 Roadmap 后建立新目标。

如果变化影响已经批准的用户结果，状态自动回到 `proposed`，重新展示结果卡。已完成历史和用户做过的决定不会被重写。

---

## 🕹️ 使用方法

### 第一次建立项目路线

1. 在 Codex、Claude Code 或 Proma Pi 中进入 Plan 模式。
2. 描述目标，选择启用 Idiots Roadmap。
3. 选择 `完全不看代码`、允许阅读的代码语言，或自由描述能力。
4. 运行或让宿主调用 `$idiots-roadmap`。
5. 没有 GitHub 时，选择私人云端备份、暂时只在本机或连接已有仓库。
6. 查看下一轮结果卡，回复“开始下一轮”或提出调整。

### Plan 里为什么可以保存 Roadmap

Roadmap 是这次规划本身，不是产品开发。Plan 中只允许保存：

- 给你看的 `IDIOTS_ROADMAP.md`；
- 给后续 AI 接力用的 `.idiotsroadmap/`。

产品代码、配置、普通文档和 Git 都不会在这一步改动。

如果宿主允许保存规划文件，Skill 会直接落盘；如果宿主把 Plan 设成彻底只读，Skill 会先把计划留在对话里。你确认 Plan 后，它只把 Roadmap 保存下来，然后立刻停止，不会顺手开始开发。

### 新 Session 继续开发

```text
$idiots-roadmap-start
```

不需要复制 Roadmap 里的长提示词，也不需要先提醒 AI 阅读哪些文件。

### 手动补收尾

```text
$idiots-roadmap-finish
```

### 检查项目与计划是否走偏

```text
$idiots-roadmap-align
```

---

## 🧰 支持范围

| 平台 | 当前支持 |
|---|---|
| Codex | 四个 Skill；hooks 可自动注入和落盘，无 hooks 时也可直接落盘 |
| Claude Code | 四个 Skill；hooks 可自动注入和落盘，无 hooks 时也可直接落盘 |
| Proma Pi | 四个 Skill；不依赖 hooks，直接落盘或在 Plan 确认后补落盘 |
| OpenCode | 暂不支持 |
| Hermes | 不支持 |

hooks 只是省掉手动触发的自动化层，不是核心能力。Proma Pi 不需要模拟 Claude/Codex hooks，也不需要等待 `ExitPlanMode` 事件。

原子落盘和跨 Session 状态管理需要 Node.js 18+。Node 不可用时仍可读取 Skill，但不能保证可靠保存、批准门和任务领取。

---

## 📦 安装

### Claude Code

```text
/plugin marketplace add idiots-roadmap/idiots-roadmap
/plugin install idiots-roadmap@idiots-roadmap
```

### Codex

```powershell
codex plugin marketplace add https://github.com/idiots-roadmap/idiots-roadmap.git
codex plugin add idiots-roadmap@idiots-roadmap
```

Codex 首次安装后运行 `/hooks`，审核并信任本地 Node.js hooks。GitHub 安装不能绕过宿主安全门。

### Proma Pi

把发布包中的 `skills/` 导入 Proma 的 Workspace Skills，然后在 Plan 中显式运行 `$idiots-roadmap`。Proma Pi 默认走 Skill 自带的便携式落盘工具，不要求 hooks。

---

## 🛡️ 不会做什么

- 不在用户批准前开始下一批；
- 不让普通 AI 状态更新伪造用户批准；
- 不要求用户维护详细技术提示词；
- 不自动创建 Session；不在用户选择前连接 GitHub，也不擅自推送；
- 没有 Git 时会在第一轮开始前由 AI 建立本地版本保护；没有 GitHub 时只询问一次去向，不把命令交给用户；
- 不把技术判断交给不看代码用户；
- 不用旧计划覆盖项目事实，也不用错误项目篡改已确定计划；
- 不在项目外保存能力、代码或私有路径；
- 不创建多套互相冲突的进度文档。

---

## 🧪 开发验证

项目没有 npm 运行时依赖：

```powershell
npm.cmd test
npm.cmd run validate
```

项目本地状态工具：

```powershell
node .idiotsroadmap/runtime/roadmap-state.mjs validate
node .idiotsroadmap/runtime/roadmap-state.mjs approve
node .idiotsroadmap/runtime/roadmap-state.mjs claim
node .idiotsroadmap/runtime/roadmap-state.mjs reclaim <work-item-id>
node .idiotsroadmap/runtime/roadmap-state.mjs apply .idiotsroadmap/next-state.json
```

首次没有项目内 runtime 时，由主 Skill 使用发布包内的便携工具执行：

```text
node <idiots-roadmap Skill 目录>/scripts/roadmap-state.mjs bootstrap .idiotsroadmap/initial-state.json <项目根目录>
```

测试覆盖未批准禁止领取、批准防伪、用户结果变化后重新批准、并行 Session 原子领取、revision 冲突、历史保护、已有项目接管和前端优先。

---

## 🗑️ 卸载

Claude Code：

```text
/plugin uninstall idiots-roadmap@idiots-roadmap
```

Codex：

```powershell
codex plugin remove idiots-roadmap@idiots-roadmap
```

卸载插件不会删除项目里的 Roadmap、状态和归档，避免误删开发历史。

---

## 📜 License

MIT © 2026 Idiots Roadmap Contributors

<div align="center">

### 人决定下一轮得到什么，AI负责怎么做和怎样接力。

</div>
