---
project_code: event-signup
last_updated_at: 2026-03-25T11:40:00+08:00
---

# Lessons Learned

> 本文件为追加型记录，不覆盖旧内容。
> 只记录重复错误或流程性错误，不记录所有零碎 bug。

## Lesson 1
- 时间：2026-03-25T11:35:00+08:00
- 错误类型：receipt
- 环节：backend
- 表现：后端初次回执没有明确写“当前问题”和“当前阻塞”，PM 汇总时信息不完整
- 根因：后端对 receipt 最低标准理解不一致
- 修正动作：要求后端严格按 receipt 模板补齐字段
- 后续约束：以后 receipt 缺少最低字段时，不得作为正式推进依据