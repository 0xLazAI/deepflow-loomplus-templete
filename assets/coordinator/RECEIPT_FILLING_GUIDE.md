# Receipt Filling Guide

## Purpose
本文件是 FE / BE 的 receipt 填写指南。
它不替代模板，不替代具体提示词，不负责 PM 的完整状态机。
它只回答三件事：

1. FE / BE 在 receipt 中各字段应该怎么填
2. PM 会如何读取这些字段
3. FE / BE 持续联调时，哪些结构化信号会触发 PM 给对侧派发 follow-up task

## Boundary
### FE / BE 负责
- 维护各自 receipt
- 填写 receipt 的主字段 `status`
- 填写 receipt 正文中的状态、问题、阻塞、产出、风险
- 填写联调信号

### PM 负责
- 维护 `00_meta/project_status.md`
- 根据最新合格 receipt 推导 `frontend_status` / `backend_status`
- 根据联调信号决定是否重发或挂起 follow-up task

### 关键边界
- FE / BE 不直接填写 `frontend_status` / `backend_status`
- `frontend_status` / `backend_status` 只存在于 `project_status.md`
- FE / BE 只在 receipt 中填写主字段 `status`

## Receipt Structure
### Required frontmatter
- `task_id`
- `project_code`
- `owner`
- `status`
- `updated_at`

### Main field: `status`
只允许：
- `in_progress`
- `blocked`
- `done`

### `status` meaning
- `in_progress`
  - 当前这轮 task 已接住，仍可继续推进
- `blocked`
  - 当前这轮 task 未完成，且现在无法继续推进
- `done`
  - 当前这轮 task 已完成

### How FE / BE choose `status`
按以下顺序判断：
1. 当前这轮 task 是否已经完成
   - 是：`done`
2. 当前这轮 task 是否已经被卡住，无法继续推进
   - 是：`blocked`
3. 其他情况
   - `in_progress`

## Receipt Body Fields
### `当前状态`
- 只填写主状态值：
  - `in_progress`
  - `blocked`
  - `done`
- 不再填写：
  - `accepted`
  - `needs_clarification`
  - `risk_notice`

### `当前可推进内容`
- 写当前仍然可以继续做的事
- 如果已经完全不能继续推进，不要把阻塞后的幻想动作写在这里

### `当前问题`
- 写当前仍存在、但未必阻塞开发的问题
- 若问题已经卡住开发，应写到 `当前阻塞`

### `当前阻塞`
- 写当前真正阻止继续推进的问题
- 若 `status=blocked`，这里不能写“无”
- 若 `status!=blocked`，这里可以写“无”

### `当前产出`
- 写这次回执时已经实际完成的产物
- 不写尚未完成的计划项

### `风险提示`
- 写仍可继续推进、但可能返工或扩散的风险
- 风险提示本身不改变主字段 `status`

### Minimum body fields
每个 receipt 至少包含：
- 当前状态
- 当前可推进内容
- 当前问题
- 当前阻塞
- 当前产出
- 风险提示

## Cross-role Follow-up Signals
联调信号不放进主状态里，单独表达。

### Frontend receipt must include
`frontend_receipt.md` 必须包含：
- `backend_followup_needed: yes / no`
- `backend_followup_ready: yes / no`
- `backend_followup_scope`
- `backend_followup_reason`

### Backend receipt must include
`backend_receipt.md` / `nodejs_receipt.md` 必须包含：
- `frontend_followup_needed: yes / no`
- `frontend_followup_ready: yes / no`
- `frontend_followup_scope`
- `frontend_followup_reason`

### Meaning
- `*_followup_needed=yes`
  - 当前 receipt 明确说明：对侧还必须继续做事
- `*_followup_ready=yes`
  - 当前 receipt 已把对侧 follow-up 的范围说清楚，PM 可以据此生成并重发 task
- `*_followup_scope`
  - 对侧需要继续做的范围
- `*_followup_reason`
  - 触发 follow-up 的原因摘要

## What PM Reads From Receipt
### PM derives `frontend_status`
PM 只按以下规则在 `project_status.md` 中推导：
1. 最新合格 `frontend_receipt.md.status=done`
   - `frontend_status=done`
2. 最新合格 `frontend_receipt.md.status=blocked`
   - `frontend_status=blocked`
3. 最新合格 `frontend_receipt.md.status=in_progress`
   - `frontend_status=in_progress`
4. `frontend_task.md` 已发出但尚未收到合格 `frontend_receipt.md`
   - `frontend_status=waiting_receipt`
5. `frontend_task.md` 尚未发出
   - `frontend_status=idle`

### PM derives `backend_status`
PM 只按以下规则在 `project_status.md` 中推导：
1. 最新合格后端回执 `status=done`
   - `backend_status=done`
2. 最新合格后端回执 `status=blocked`
   - `backend_status=blocked`
3. 最新合格后端回执 `status=in_progress`
   - `backend_status=in_progress`
4. 后端任务文档已发出但尚未收到合格后端回执
   - `backend_status=waiting_receipt`
5. 后端任务文档尚未发出
   - `backend_status=idle`

## Follow-up State In PM
PM 在 `project_status.md` 中维护：

### `frontend_followup`
- `required: yes / no`
- `dispatched: yes / no`
- `blocked_by: frontend_not_done / none`
- `reason`

### `backend_followup`
- `required: yes / no`
- `dispatched: yes / no`
- `blocked_by: backend_not_done / none`
- `reason`

## When PM Dispatches Follow-up
### When PM receives backend receipt
若合格后端回执明确给出：
- `frontend_followup_needed=yes`
- `frontend_followup_ready=yes`

则：
1. 若 `project_status.md.frontend_status=done`
   - 立即更新并重发 `02_handoff/frontend_task.md`
   - 写：
     - `frontend_followup.required=yes`
     - `frontend_followup.dispatched=yes`
     - `frontend_followup.blocked_by=none`
2. 若 `project_status.md.frontend_status!=done`
   - 暂不重发
   - 写：
     - `frontend_followup.required=yes`
     - `frontend_followup.dispatched=no`
     - `frontend_followup.blocked_by=frontend_not_done`

### When PM receives frontend receipt
若合格前端回执明确给出：
- `backend_followup_needed=yes`
- `backend_followup_ready=yes`

则：
1. 若 `project_status.md.backend_status=done`
   - 按 `backend_executor` 立即重发后端任务文档
2. 若 `project_status.md.backend_status!=done`
   - 暂不重发
   - 写：
     - `backend_followup.required=yes`
     - `backend_followup.dispatched=no`
     - `backend_followup.blocked_by=backend_not_done`

## When PM Resumes Suspended Follow-up
### Resume frontend follow-up
若本轮 receipt 使 `project_status.md.frontend_status` 变为 `done`，且同时满足：
- `frontend_followup.required=yes`
- `frontend_followup.dispatched=no`

则：
- 立即更新并重发 `02_handoff/frontend_task.md`
- 同时把：
  - `frontend_followup.dispatched=yes`
  - `frontend_followup.blocked_by=none`

### Resume backend follow-up
若本轮 receipt 使 `project_status.md.backend_status` 变为 `done`，且同时满足：
- `backend_followup.required=yes`
- `backend_followup.dispatched=no`

则：
- 按 `backend_executor` 更新并重发后端任务文档
- 同时把：
  - `backend_followup.dispatched=yes`
  - `backend_followup.blocked_by=none`
