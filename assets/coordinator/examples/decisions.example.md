---
project_code: event-signup
last_updated_at: 2026-03-25T10:35:00+08:00
---

# Decisions

## Decision 1
- 时间：2026-03-25T09:40:00+08:00
- 阶段：clarification_pending
- 决策：第一轮 MVP 不做登录
- 原因：先验证报名主流程，避免权限系统影响交付速度
- 影响：frontend_task 和 backend_task 都无需引入登录前置条件
- 来源：demand_owner

## Decision 2
- 时间：2026-03-25T09:55:00+08:00
- 阶段：clarification_pending
- 决策：第一轮 MVP 不做导出
- 原因：导出不影响主用户路径，可后续补充
- 影响：后台仅需支持列表展示，不需支持导出能力
- 来源：PM