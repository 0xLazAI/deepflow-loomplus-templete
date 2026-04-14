---
project_code: <project_code>
project_name: <project_name>
stage: new
owner: demand_owner
backend_executor: demo-worker
frontend_status: idle
backend_status: idle
needs_owner_action: false
next_action: await_requirement
last_updated_at: <ISO8601>
---

# 项目状态

> 本文件是项目主状态板，优先级最高。
> 所有状态字段必须基于已落盘文档、已收到的 receipt、已收到的 review 或已确认的需求输入填写。
> 不得根据模糊记忆、口头印象或未落盘结论填写状态。
> `frontend_status` / `backend_status` 是 PM 在本文件中维护的汇总字段，不是 FE / BE 在 receipt 中填写的字段。
> FE / BE 只在各自 receipt 中填写主字段 `status`；PM 再根据任务是否已发出以及最新合格 receipt 的 `status` 推导这两个汇总字段。

## 状态字段约束
- `stage` 只允许：
  - `new`
  - `clarification_pending`
  - `ready_for_handoff`
  - `frontend_in_progress`
  - `backend_in_progress`
  - `blocked`
  - `ready_for_demo`
  - `iterating`
  - `done`
- `frontend_status` / `backend_status` 只允许：
  - `idle`
  - `waiting_receipt`
  - `blocked`
  - `in_progress`
  - `done`
- `needs_owner_action` 只允许：`true` / `false`
- `backend_executor` 固定为：`demo-worker`
- `next_action` 只允许：
  - `await_requirement`
  - `clarify_blocking_questions`
  - `update_product_docs`
  - `dispatch_frontend_task`
  - `dispatch_backend_task`
  - `dispatch_frontend_and_backend_tasks`
  - `wait_frontend_receipt`
  - `wait_backend_receipt`
  - `wait_receipts`
  - `summarize_receipts`
  - `summarize_review`
  - `prepare_demo`
  - `wait_owner_review`
  - `plan_next_iteration`
  - `close_project`

## 状态填写顺序
1. 先根据 role status mapping table 判断 `frontend_status`
2. 再根据 role status mapping table 判断 `backend_status`
3. 再根据 stage mapping table 判断 `stage`
4. 再判断 `needs_owner_action`
5. 最后填写 `next_action`

## Role status mapping table
以下映射只用于 PM 填写 `project_status.md`，不属于 FE / BE 需要在 receipt 中直接填写的字段。

### `frontend_status`
按以下顺序判断：
1. `done`
   - 已收到合格 `frontend_receipt.md`，且当前状态明确为 `done`
2. `blocked`
   - 已收到 `frontend_receipt.md`，且当前状态明确为 `blocked`
3. `in_progress`
   - 已收到 `frontend_receipt.md`，且当前状态为 `in_progress`
5. `waiting_receipt`
   - `frontend_task.md` 已发出，但尚未收到 `frontend_receipt.md`
6. `idle`
   - `frontend_task.md` 尚未发出

### `backend_status`
按以下顺序判断：
1. `done`
   - 已收到合格后端回执（`backend_receipt.md` 或 `nodejs_receipt.md`），且当前状态明确为 `done`
2. `blocked`
   - 已收到后端回执（`backend_receipt.md` 或 `nodejs_receipt.md`），且当前状态明确为 `blocked`
3. `in_progress`
   - 已收到合格后端回执（`backend_receipt.md` 或 `nodejs_receipt.md`），且当前状态为 `in_progress`
5. `waiting_receipt`
   - 后端任务文档（`backend_task.md` 或 `nodejs_task.md`）已发出，但尚未收到对应后端回执
6. `idle`
   - 后端任务文档（`backend_task.md` 或 `nodejs_task.md`）尚未发出

## Stage mapping table
按以下顺序判断 `stage`；命中更高优先级后不再继续：
1. `blocked`
   - 存在任一 blocking exception
   - 或 review 明确指出阻塞性问题
   - 或某一侧 receipt 明确为 `blocked` 且影响主流程
2. `new`
   - project 已 bind，但最小初始化尚未完成
3. `clarification_pending`
   - 当前轮目标未明确
   - 或最小 MVP 未明确
   - 或 `阻塞性未确认问题` 非无
   - 或 primary input type 为 `new_request` / `modify_request` / `answer_clarification` 且 handoff gate 未满足
4. `ready_for_handoff`
   - handoff gate 已满足
   - 且 `frontend_task.md` / 后端任务文档（`backend_task.md` 或 `nodejs_task.md`）尚未发出，或刚更新待发出
5. `ready_for_demo`
   - demo gate 已满足
   - 且当前轮已有可展示结果
6. `iterating`
   - 当前轮已有 demo、非阻塞 review 或 bug 反馈
   - 且这些反馈尚未完全吸收到当前轮范围、状态或下一步动作中
7. `frontend_in_progress`
   - `frontend_status` 属于 `waiting_receipt` / `in_progress`
   - 且 `backend_status` 不属于上述三者
8. `backend_in_progress`
   - `backend_status` 属于 `waiting_receipt` / `in_progress`
   - 且 `frontend_status` 不属于上述三者
9. 并行推进兜底
   - 若 `frontend_status` 与 `backend_status` 同时属于 `waiting_receipt` / `in_progress`
   - 固定写 `frontend_in_progress`
   - 并在 `Stage reason` 中明确说明 backend 也在推进
10. `done`
   - 当前项目已明确完成
   - 且无阻塞问题
   - 且无待需求方动作
   - 且无当前轮未处理回执或阻塞性 review 结论
11. 若仍无法稳定判定
   - 回退到 `clarification_pending`
   - 并在 `Stage reason` 中写明不确定点

## Owner action mapping table
- 仅当以下任一条件成立时，`needs_owner_action=true`：
  - `阻塞性未确认问题` 非无
  - 当前 `stage=blocked` 且阻塞解除依赖需求方拍板
  - `next_action=wait_owner_review`
- 其余情况默认写 `false`

## Next action selection rules
- `await_requirement`
  - 仅用于项目刚初始化，尚未收到有效需求输入
- `clarify_blocking_questions`
  - `阻塞性未确认问题` 非无
- `update_product_docs`
  - 当前存在尚未落盘到 `requirement_brief.md` / `prd.md` / `open_questions.md` 的需求变化
- `dispatch_frontend_task`
  - 仅需发出或重发 `frontend_task.md`
  - 或 `frontend_followup.required=yes`、`frontend_followup.dispatched=no` 且前端最近一条合格 `frontend_receipt.md` 的 `status` 为 `done` 或 `blocked`
- `dispatch_backend_task`
  - 仅需发出或重发后端任务文档（`backend_task.md` 或 `nodejs_task.md`）
  - 或 `backend_followup.required=yes`、`backend_followup.dispatched=no` 且目标后端最近一条合格回执的 `status` 为 `done` 或 `blocked`
- `dispatch_frontend_and_backend_tasks`
  - 两个 handoff 都需立即发出或重发
- `wait_frontend_receipt`
  - 当前只缺 `frontend_receipt.md`
- `wait_backend_receipt`
  - 当前只缺后端回执（`backend_receipt.md` 或 `nodejs_receipt.md`）
- `wait_receipts`
  - 当前至少缺一侧 receipt
  - 且本轮没有新的合格 receipt 待汇总
- `summarize_receipts`
  - 本轮已收到新的合格 receipt
  - 且该 receipt 尚未汇总到 `project_status.md` / `decisions.md` / `iteration_log.md`
- `summarize_review`
  - 已收到新的合格 review 文件
  - 且该 review 尚未汇总到 `project_status.md` / `decisions.md` / `iteration_log.md`
- `prepare_demo`
  - demo gate 已满足
  - 且 `current_demo.md` 尚未更新为当前轮内容
- `wait_owner_review`
  - `current_demo.md` 已更新为当前轮内容
  - 且当前等待需求方 review 或确认
- `plan_next_iteration`
  - 当前轮已有 demo / review / bug 反馈
  - 且下一轮目标、问题和范围尚未整理完成
- `close_project`
  - 当前项目已完成
  - 且 `stage` 尚未更新为 `done`

## 状态一致性检查
- `stage=ready_for_handoff` 时，`frontend_status` 和 `backend_status` 应为 `idle`
- `stage=frontend_in_progress` 时，`frontend_status` 不得为 `idle`
- `stage=backend_in_progress` 时，`backend_status` 不得为 `idle`
- 若 `frontend_status` 与 `backend_status` 同时处于推进中，`stage` 必须固定写 `frontend_in_progress`
- `stage=blocked` 时，`当前阻塞`、`阻塞性未确认问题`、角色状态三者中至少有一项能支撑 blocked 判断
- `stage=done` 时：
  - `当前阻塞` 必须为无
  - `阻塞性未确认问题` 必须为无
  - `needs_owner_action` 必须为 `false`
- `next_action=plan_next_iteration` 时，当前轮必须已经存在 demo / review / bug 反馈
- `next_action=update_product_docs` 时，当前必须存在尚未落盘的需求变化
- `next_action=summarize_receipts` 时，本轮必须存在尚未汇总的新 receipt
- `next_action=summarize_review` 时，本轮必须存在尚未汇总的新 review

## 状态判断依据
### Stage reason
<一句话解释为什么当前 stage 是这个值，只写当前最直接原因>

### Frontend status reason
<一句话解释 frontend_status 的依据；若无前端任务则写“未发出 frontend task”>

### Backend status reason
<一句话解释 backend_status 的依据；若无后端任务则写“未发出后端 task”>

### Backend executor reason
<一句话解释 backend_executor 的依据；默认写“当前基座默认使用 demo-worker 执行 handoff”>

### Owner action reason
<若 needs_owner_action=true，写清需要需求方做什么；否则写“无”>

## 当前目标
<一句话描述当前轮目标>

## 已确认范围
- <item 1>
- <item 2>
或写：无

## 未确认问题
- <item 1>
- <item 2>
或写：无

## 阻塞性未确认问题
- <item 1>
- <item 2>
或写：无

## 当前进展
- <item 1>
- <item 2>
或写：无

## 当前阻塞
- <item 1>
- <item 2>
或写：无

## 当前等待项
- <item 1>
- <item 2>
或写：无

## 联调 follow-up 状态
### frontend_followup
- required: <yes / no>
- dispatched: <yes / no>
- blocked_by: <frontend_not_done / none>
- reason: <一句话说明原因，若无则写“无”>

### backend_followup
- required: <yes / no>
- dispatched: <yes / no>
- blocked_by: <backend_not_done / none>
- reason: <一句话说明原因，若无则写“无”>

## 当前依据文档
- <doc path 1>
- <doc path 2>
或写：无

## 下一步
- <item 1>
- <item 2> 
或写：无
