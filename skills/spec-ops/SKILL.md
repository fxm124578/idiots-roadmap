---
name: spec-ops
description: 将项目内 Markdown 产品策划案的引用、选区或实际编辑定位为稳定设计单元，建立轻量追溯地图、用产品语言分析影响，并同步可核查的策划案状态。适用于用户引用或修改中文策划案后，希望修复、改规则、验证、讨论产品行为或查找相关实现时。
---

# 策划案驱动开发

用户只需引用、选中或编辑策划案；不要要求其补充代码、模块、页面或日志。

## 工作流

1. 运行 `node scripts/spec-ops.mjs parse <策划案文件或目录> [--lines 起止]`，以隐藏的 `<!-- unit: stable.id -->` 定位设计单元。没有实际改动也没有明确诉求时，只问：修复、改规则、验证还是讨论？
2. 先运行 `node scripts/spec-ops.mjs diff <策划案路径> <项目根目录>`。规则、用户目标或验收条件发生实际变化时，默认任务是**修改产品**，不是更新策划案。只有纯状态/文字整理、用户明确只讨论或验证、或高风险/冲突/映射不可靠时，才不改产品；说明原因，并绝不把状态同步成“已实现”。
3. 运行 `node scripts/spec-ops.mjs index <策划案路径> <项目根目录> [--write]`，局部复查候选实现后，执行最小必要产品改动并运行相关验证。不要用“追溯地图”代替修改；也不要先运行 `sync`。名称匹配得到的映射一律是 `inferred`，只能作为检查线索。
4. 运行 `node scripts/spec-ops.mjs impact <unit-id> <项目根目录>`，用产品语言说明会改、会检查与明确不改。只有 `verified` 或当前局部复查的 `observed` 映射可以列为“会改”。
5. 产品改动和验证完成后，才运行 `node scripts/spec-ops.mjs sync <项目根目录> <策划案路径> [--status 状态] [--change 说明]`，最后运行 `node scripts/spec-ops.mjs validate <项目根目录>`。

## 规则

- 每个单元只承诺一个用户可判断的行为。标题与位置可改，隐藏 ID 必须保留；ID 缺失或重复时进入恢复流程，不能猜。
- `.product-trace/` 是 AI 维护的本地追溯资料，包含 `state.json`、`index.json`、`snapshots/`、`changes/`。所有写入先写临时文件并原子替换。
- `inferred`、`stale`、`unknown` 只能是“会检查”；测试不能运行时，状态只能是“已修改，待验证”。`sync` 只记录已经发生的产品事实，不能代替产品改动。
- 数据删除、权限、收费、外部 API 或不兼容行为，先用产品语言说明影响并等待确认。

完整格式示例和可信度含义见 [references/format.md](references/format.md)。
