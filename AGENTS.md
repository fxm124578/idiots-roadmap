# Idiots Roadmap 项目规则

## 产品边界

- V1 只支持 Codex 与 Claude Code，不实现 OpenCode、Hermes 或其他宿主适配。
- Skill 只在 Plan 模式提供 Roadmap 协议；非 Plan 模式必须静默。
- 自动化只负责询问、生成、校验和落盘 `IDIOTS_ROADMAP.md`，不得批准计划、开始开发或持续监听反馈。
- 不调用外部 API、额外模型或网络服务，不在全局位置保存用户能力。

## 文档与交互

- 项目文档默认使用中文；代码标识符、协议字段和命令使用英文。
- `README.md` 中文优先；生成的 Roadmap 跟随当前对话语言。
- 面向不会开发的用户解释“为什么”和“对用户的影响”，避免只描述实现。
- 用户验收每步最多两项；无代码模式不得要求查看代码、终端、日志或测试报告。

## 目录职责

- `skills/idiots-roadmap/`：跨宿主共享 Skill，只存放代理执行所需内容。
- `hooks/`：Codex 与 Claude Code 共用 hook 配置和零依赖 Node.js 脚本。
- `.codex-plugin/`：Codex 插件清单。
- `.claude-plugin/`：Claude Code 插件清单。
- `.agents/plugins/`：Codex GitHub marketplace 清单。
- `.claude-plugin/marketplace.json`：Claude Code GitHub marketplace 清单。
- `tests/`：`node:test` 测试、fixture 与黄金样例。
- `.github/workflows/`：跨平台 CI。
- 根目录文档只放用户需要的项目说明、许可和贡献规则。

## 命名与格式

- 文件与目录优先使用小写 kebab-case；宿主规定的固定文件名除外。
- JavaScript 使用 ESM `.mjs`，仅依赖 Node.js 18+ 标准库。
- JSON 使用 2 空格缩进并以换行结尾。
- 内部 Roadmap 协议字段使用稳定英文名，用户可见内容按会话语言生成。

## 实现约束

- 所有路径必须从已确认的项目根目录解析；拒绝路径穿越和指向项目外的符号链接。
- 写入 Roadmap 使用同目录临时文件和原子重命名；校验失败不得覆盖旧文件。
- 新目标覆盖前归档旧 Roadmap；同一目标或能力切换只改写未完成步骤，已完成步骤原样保留。
- hooks 缺少 Node.js 或遇到不支持的输入时应安全退出，不影响宿主正常工作。
- 密钥、token、用户私有路径和运行时缓存不得提交。

## 测试与发布

- 每次行为变更都必须补充或更新 `node:test`。
- 提交前运行 Skill、插件清单、marketplace、Roadmap 协议和全量测试验证。
- CI 覆盖 Windows、macOS、Linux 与 Node.js 18+。
- 不自动执行 `git push` 或发布；只有用户明确要求时才进行。

## 清理规则

- 临时测试目录由测试自身清理，不进入仓库。
- 不提交 `node_modules/`、覆盖率输出、hook 临时文件或生成的用户 Roadmap。
- 过期黄金样例应更新或删除，不保留重复版本。
