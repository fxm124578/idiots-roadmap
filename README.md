# 🗺️ Idiots Roadmap

> **AI 给你的计划看起来很专业，但你真的知道下一步该让它做什么吗？**

<div align="center">

🧩 **不把计划写得更长，只把每一步拆得更清楚**<br>
👀 **不懂代码，也能看见结果、给出反馈、判断是否通过**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Codex%20|%20Claude%20Code-blue)]()
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933)](https://nodejs.org/)
[![Mode](https://img.shields.io/badge/Mode-Plan%20Only-orange)]()

</div>

---

## 🤔 你有没有遇到过……

AI 给你列了一份十几条的技术计划：

> “先完成数据库迁移，再抽象服务层，然后重构状态管理……”

每一个字你都认识，但连起来就不知道该怎么验收。

于是开发过程变成了：

> “你先继续做吧。”<br>
> “现在做完了吗？”<br>
> “好像不太对，再改改。”<br>
> “等等，前面到底做了什么？”

问题通常不是计划不够详细，而是它只写给开发者看：

- 🧱 一步塞进了太多互相独立的改动
- 🌫️ 用户看不到中间结果，只能等 AI 宣布“完成”
- 🧪 验收变成看代码、看日志、看测试——但你根本不看这些
- 🔄 反馈没有明确边界，一句话就让 AI 重做半个项目

🧭 **Idiots Roadmap 要解决的不是“AI 应该怎么开发”，而是“用户应该怎么把开发一步步带到终点”。**

---

## 🎯 Idiots Roadmap 是什么

**Idiots Roadmap** 是一个只在 Plan 模式工作的开发计划 Skill。

它会把 AI 的技术计划重新拆成一份写给用户看的 `IDIOTS_ROADMAP.md`：

### 📄 模拟输出案例

假设你想给一个现有项目增加任务列表，Roadmap 中的一个子步骤会长这样：

**🧩 子步骤 1：先看到可点击的任务列表**

📋 第 1 步 — 复制以下提示词发给开发 AI：

```text
请只实现一个可打开、可点击的任务列表页面。

🎯 要求：
- 交付一个可打开的任务列表页，用户可以查看演示任务并切换状态筛选。
- 显示任务名称、状态和状态筛选。
- 暂时使用演示数据，并在页面上明确标注。
- 运行必要的前端检查，告诉我如何打开页面。
- 完成后停止并等待我的验收；不要继续实现后端。

⚠️ 约束：沿用项目现有界面风格，不引入新的前端框架或无关功能。

【🚧 边界条件】
- 本步骤不实现新增、删除、登录权限或真实数据保存。
- 暂不可用的操作必须明确标注，不能伪装成已经完成。

【✅ 验收标准】
- 按开发 AI 给出的方法打开页面，能看到任务列表并切换状态筛选。
- 页面明确说明当前使用演示数据，未实现的操作没有表现为可用。
```

☑️ 第 2 步 — 人工验收清单（2 项）：

- [ ] 按开发 AI 给出的方法打开页面，能看到任务列表并切换状态筛选。
- [ ] 页面明确说明当前使用演示数据，未实现的操作没有表现为可用。

💬 第 3 步 — 回复：`1 通过，请继续。`

每个步骤都必须：

1. 只产生一个连贯、可运行的结果；
2. 允许用户单独体验和反馈；
3. 验收通过后，才进入下一步。

> 🪜 **真正适合小白的计划，不是没有技术，而是不要求用户替 AI 理解技术。**

---

## 👤 谁适合用

适合所有正在用 AI 开发产品、但不想被技术计划牵着走的人：

- 🏄 刚开始 Vibe Coding，看不懂代码也不想装懂
- 🧑‍💼 产品、运营、市场或创业者，需要自己把控开发结果
- 👨‍💻 能看一部分代码，但只熟悉 Python 或前端等特定语言
- 🔁 经常做到一半才发现方向错了，返工和 token 消耗都很高
- 🧠 希望自己掌握验收，而不是把“完成”的定义交给 AI

你可以选择：

- `完全不看代码`
- `能看 Python 基础代码`
- `能看 JavaScript/TypeScript/CSS 基础代码`
- 用“其他”自由描述自己的能力边界

系统只会在你声明的范围内设计验收，不会默认扩大你的技术能力。

---

## ✨ 有它和没它，有什么区别

<div align="center">

| 🌫️ 普通技术计划 | 🗺️ Idiots Roadmap |
|---|---|
| “完成认证模块和数据库迁移” | “先打开登录页，确认流程和提示是否正确” |
| AI 说测试通过，你只能相信 | 你亲自操作页面或样例，自己判断 |
| 一轮做五件事，反馈不知道从哪改 | 一步一个结果，哪里不对就改哪里 |
| 后端做了很久，用户什么都看不到 | 无代码模式有前端就先做可见页面 |
| “再调整一下”导致大面积返工 | 每步都写明不做什么 |
| 计划只告诉 AI 怎么写代码 | Roadmap 告诉你怎么指挥 AI |

</div>

---

## 🎬 三步上路

```text
# 1️⃣ 进入 Plan 模式，描述你想做的产品
“我想给现有项目增加一个任务管理功能……”

# 2️⃣ 启用 Idiots Roadmap，并选择你的能力范围
“启用 Idiots Roadmap”
“完全不看代码”

# 3️⃣ 打开 IDIOTS_ROADMAP.md，从第一个未完成步骤开始
复制提示词 → 让 AI 开发 → 按两项以内的条目验收 → 通过后继续
```

Skill 写完 Roadmap 就会停止。

它不会自动批准计划、退出 Plan、开始开发，也不会替你擅自把步骤标记为完成。

---

## 🖥️ 完全不看代码？先让你看到页面

如果项目包含前端，Idiots Roadmap 会把前端验证提前：

```text
第 1 步：先做出可打开、可点击的页面
        ↓
用户直接体验布局、文案和核心流程
        ↓
后续再接真实后端、数据库和业务规则
        ↓
回到同一页面，验证真实数据和真实行为
```

后端还没做好时，可以先使用演示数据，但必须遵守三条规则：

- 🏷️ 页面明确标注“演示数据”
- 🚫 支付、权限、安全、数据写入等未完成功能不能伪装成可用
- 🔌 后续必须安排真实接口集成，并再次从前端验收

如果项目没有前端，则优先提供样例输入输出、可打开报告或其他用户能理解的结果。

---

## 📋 Roadmap 长什么样

````markdown
**🧩 子步骤 1：看到可点击的任务列表**

📋 第 1 步 — 复制以下提示词发给开发 AI：

```text
只实现任务列表页面，不接真实写入接口。

🎯 要求：
- 运行必要检查。
- 告诉我打开页面的方法，然后停止等待验收。

⚠️ 约束：不引入新的前端框架，不修改无关页面。

【🚧 边界条件】
不实现新增、删除、权限和数据写入，不重构其他页面。

【✅ 验收标准】
- 页面能正常打开，任务列表和筛选入口清楚可见。
- 演示数据及未实现功能都有明确标识。
```

☑️ 第 2 步 — 人工验收清单（2 项）：

- [ ] 页面能正常打开，任务列表和筛选入口清楚可见。
- [ ] 演示数据及未实现功能都有明确标识。

💬 第 3 步 — 回复：`1 通过，请继续。`
````

用户验收永远不超过两项。

技术测试仍然会要求开发 AI 执行，但不会把日志、终端或测试报告丢给完全不看代码的用户。

---

## 🧰 支持的平台

| 平台 | 工作模式 | 自动能力 |
|---|---|---|
| 🟢 **Codex** | Plan 模式 | 两轮选择、动态语言选项、自动落盘 |
| 🟣 **Claude Code** | Plan 模式 | 两轮选择、动态语言选项、自动落盘 |
| ⚪ OpenCode | V1 不支持 | 后续再评估 |
| ⚪ Hermes | 不支持 | 缺少可靠的原生 Plan 模式 |

自动 hooks 需要 **Node.js 18+**。

如果没有 Node.js，Skill 仍可手动调用，但自动提问和自动落盘会静默停用，不影响宿主正常工作。

---

## 📦 安装

### Claude Code

在 Claude Code 中分两次执行：

```text
/plugin marketplace add idiots-roadmap/idiots-roadmap
/plugin install idiots-roadmap@idiots-roadmap
```

然后进入 Plan 模式开始一个新计划。

### Codex

```powershell
codex plugin marketplace add https://github.com/idiots-roadmap/idiots-roadmap.git
codex plugin add idiots-roadmap@idiots-roadmap
```

安装后运行 `/hooks`，检查并信任 `idiots-roadmap` 的三个本地 Node.js hook，再新建一个 Plan 模式任务。

> 🔐 GitHub 安装不能绕过宿主的 hook 信任门。首次人工审核不是多余步骤，而是防止第三方插件在本机执行未知命令。

---

## 🕹️ 怎么使用

1. 在项目中切换到 Plan 模式。
2. 描述一个新的开发目标。
3. 第一轮选择 `启用 Idiots Roadmap`。
4. 第二轮选择自己的能力范围。
5. 继续回答 AI 正常的产品和实现问题。
6. 打开项目根目录的 `IDIOTS_ROADMAP.md`。
7. 复制第一个未完成步骤的提示词，让开发 AI 只完成这一步。
8. 按最多两项用户验收检查结果，明确回复通过后再继续。

同一计划的后续澄清不会重复询问。

要切换能力范围，请重新进入 Plan 模式或显式调用 `$idiots-roadmap`。切换后：

- ✅ 已完成步骤保持原样
- ✍️ 所有未完成步骤按新能力范围重写

开始新目标时，旧 Roadmap 会自动归档到：

```text
.idiotsroadmap/archive/时间-目标.md
```

---

## 🛡️ 它不会做什么

| 边界 | 为什么 |
|---|---|
| 不在 Build 模式运行 | 防止 Roadmap 生成和实际开发混在一起 |
| 不自动批准或退出 Plan | 计划控制权仍然属于用户 |
| 不自动开始下一步 | 只有用户明确验收通过才继续 |
| 不调用外部 API 或额外模型 | 不增加隐性费用和隐私风险 |
| 不保存全局能力档案 | 每个项目、每个目标都按当前选择处理 |
| 不覆盖校验失败的旧文件 | AI 连续两次输出错误时，保住已有 Roadmap |

写入时使用临时文件和原子重命名，并拒绝路径穿越或指向项目外部的符号链接。

---

## 🛟 hooks 没运行怎么办

在 Plan 模式显式输入：

```text
Use $idiots-roadmap to turn this proposal into a user-verifiable roadmap.
```

Skill 仍会生成完整 Roadmap。此时把标记内的 Markdown 手动保存为项目根目录的 `IDIOTS_ROADMAP.md` 即可。

---

## 🧪 开发与验证

项目没有 npm 运行时依赖。

```powershell
npm test
npm run validate
```

测试覆盖 Codex/Claude hook 输入、Plan/非 Plan 分流、启用与跳过、格式校验、单次纠错、归档、能力切换、路径安全，以及以下黄金场景：

- 完全不懂代码的新前端项目
- 已有前端、后端尚未实现
- 演示数据后接入真实接口
- 纯后端或 CLI 项目的无代码验收
- Python、前端语言和自定义能力
- 已有部分完成步骤后的能力切换

CI 在 Windows、macOS、Linux 和 Node.js 18/20/22 上运行。

---

## 🗺️ Roadmap

- [x] Codex 与 Claude Code V1
- [x] 完全不看代码与指定语言阅读模式
- [x] 无代码模式前端优先
- [x] Roadmap 校验、归档和安全写入
- [ ] 评估 OpenCode 的可靠 Plan 模式接入
- [ ] 更直观的 Roadmap 进度展示
- [ ] 更多真实项目黄金样例

---

## 🔧 发布前配置

当前插件清单默认使用：

```text
https://github.com/idiots-roadmap/idiots-roadmap
```

如果实际 GitHub 所有者或仓库名不同，发布前同步修改：

- `.codex-plugin/plugin.json`
- `.claude-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- 本 README 的安装命令

修改后运行全量验证。项目不会自动执行 `git push` 或发布。

---

## 🗑️ 卸载

**Claude Code**

```text
/plugin uninstall idiots-roadmap@idiots-roadmap
```

**Codex**

```powershell
codex plugin remove idiots-roadmap@idiots-roadmap
```

卸载只移除插件。项目中已经生成的 `IDIOTS_ROADMAP.md` 和 `.idiotsroadmap/archive/` 会保留，避免误删用户计划。

---

## 🤝 贡献

发现步骤拆得不合理、验收对小白不友好，或者某个平台 hook 行为异常？欢迎提交 Issue 和 PR。

1. Fork 本仓库
2. 创建 feature 分支
3. 添加或更新对应测试
4. 运行 `npm test` 和 `npm run validate`
5. 提交 Pull Request

---

## 📜 License

MIT © 2026 Idiots Roadmap Contributors

---

<div align="center">

### 🪜 不需要先学会开发，才能把产品一步步做出来。

**看见结果，给出反馈，通过以后，再走下一步。**

</div>
