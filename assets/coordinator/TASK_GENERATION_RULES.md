# TASK_GENERATION_RULES

## Purpose
本文件只定义 `coordinator` 生成、重发和恢复 handoff task 的规则。
不要在 `TOOLS.md` 中重复展开 task 模板、follow-up scope 传递或 task 重发细节。

## Scope
本文件只覆盖：
- `02_handoff/frontend_task.md`
- `02_handoff/backend_task.md`
- `02_handoff/nodejs_task.md`

不覆盖：
- receipt 最低标准
- review 汇总
- docs-manager 命令解析
- owner-notify

## Initialization boundary
- 初始化阶段只创建 `coordinator` 自己负责维护的最小文档
- 不要在 handoff 门槛满足前创建：
  - `02_handoff/frontend_task.md`
  - `02_handoff/backend_task.md`
  - `02_handoff/nodejs_task.md`
- 后端 handoff 默认写 `02_handoff/backend_task.md`
- 只有当本轮明确选择 Node.js 风格后端文档路径时，才改写 `02_handoff/nodejs_task.md`

## Mandatory reads before task generation
生成或重发任一 handoff task 前，至少读取：
- `00_meta/project_status.md`
- `01_product/requirement_brief.md`
- `01_product/prd.md`
- `01_product/open_questions.md`
- 对应 `templates/*.template.md`
- 若存在同名示例文件，可同时参考对应 `examples/*.example.md`
- 若本次更新由 follow-up 触发，必须额外读取 source receipt 中对应的 `*_followup_scope`

## Write mode for handoff tasks
- `02_handoff/frontend_task.md` 使用 `write`
- `02_handoff/backend_task.md` 使用 `write`
- `02_handoff/nodejs_task.md` 使用 `write`

## Main workflow insertion point
- 主协调流程在满足 handoff 门槛、进入执行阶段时，才允许创建或更新 `02_handoff/*.md`
- 进入开发阶段时：
  - 必须生成或更新 `02_handoff/frontend_task.md`
  - 后端按 `backend_executor` 二选一：
    - `02_handoff/backend_task.md`
    - `02_handoff/nodejs_task.md`
- task 的创建、更新、重发、挂起恢复与模板严格遵循，一律由本文件定义

## Template conformance
- task 文档必须严格保留模板 frontmatter 字段名
- task 文档必须严格保留模板 section 名、顺序和层级
- 不允许把 task frontmatter 改写成：
  - `version`
  - `updated_at`
  - `owner: pm`
  - `executor`
- frontend task 只能使用 `templates/frontend_task.template.md`
- backend task 只能使用 `templates/backend_task.template.md`
- nodejs task 只能使用 `templates/nodejs_task.template.md`

## Frontend task generation
### Create or update `02_handoff/frontend_task.md` when:
- 首次满足 handoff 门槛
- 需求范围变化
- 默认假设变化
- receipt 指出 handoff 不清
- 合格后端回执（`backend_receipt.md` 或 `nodejs_receipt.md`）明确给出：
  - `frontend_followup_needed=yes`
  - `frontend_followup_ready=yes`
  且前端最近一条合格 `frontend_receipt.md` 的 `status` 为 `done` 或 `blocked`
- `project_status.md` 中存在尚未派发的 `frontend_followup`，且前端最近一条合格 `frontend_receipt.md` 的 `status` 变为 `done` 或 `blocked`

### Suspend instead of dispatch when:
- 后端回执提出 `frontend_followup`
- 但前端最近一条合格 `frontend_receipt.md` 的 `status` 不为 `done` 或 `blocked`
- 或当前尚无合格 `frontend_receipt.md`

### Scope carry-over
- 若本次更新由后端回执中的 `frontend_followup_needed=yes` 且 `frontend_followup_ready=yes` 触发，则 `frontend_followup_scope` 必须写入重发后的 `frontend_task.md` 的 `输入依据`
- 若 `frontend_followup_scope` 中包含链接、路径、接口说明、字段说明、调用示例、文档入口或其他前端继续实现所需资料，重发 task 时不得丢失这些内容

## Backend task generation
### Create or update `02_handoff/backend_task.md` when:
- 首次满足 handoff 门槛，且当前使用默认后端文档路径 `backend_task.md`
- 需求范围变化
- 默认假设变化
- receipt 指出 handoff 不清
- 合格 `frontend_receipt.md` 明确给出：
  - `backend_followup_needed=yes`
  - `backend_followup_ready=yes`
  且目标后端最近一条合格 `backend_receipt.md` 的 `status` 为 `done` 或 `blocked`
- `project_status.md` 中存在尚未派发的 `backend_followup`，且目标后端最近一条合格 `backend_receipt.md` 的 `status` 变为 `done` 或 `blocked`

### Scope carry-over
- 若本次更新由前端回执中的 `backend_followup_needed=yes` 且 `backend_followup_ready=yes` 触发，则 `backend_followup_scope` 必须写入重发后的 `backend_task.md` 的 `输入依据`
- 若 `backend_followup_scope` 中包含链接、路径、接口说明、字段要求、行为约束、文档入口或其他后端继续实现所需资料，重发 task 时不得丢失这些内容

## Nodejs task generation
### Create or update `02_handoff/nodejs_task.md` when:
- 首次满足 handoff 门槛，且当前使用 Node.js 风格后端文档路径 `nodejs_task.md`
- 需求范围变化
- 默认假设变化
- receipt 指出 handoff 不清
- 合格 `frontend_receipt.md` 明确给出：
  - `backend_followup_needed=yes`
  - `backend_followup_ready=yes`
  且目标后端最近一条合格 `nodejs_receipt.md` 的 `status` 为 `done` 或 `blocked`
- `project_status.md` 中存在尚未派发的 `backend_followup`，且目标后端最近一条合格 `nodejs_receipt.md` 的 `status` 变为 `done` 或 `blocked`

### Scope carry-over
- 若本次更新由前端回执中的 `backend_followup_needed=yes` 且 `backend_followup_ready=yes` 触发，则 `backend_followup_scope` 必须写入重发后的 `nodejs_task.md` 的 `输入依据`
- 若 `backend_followup_scope` 中包含链接、路径、接口说明、字段要求、行为约束、文档入口或其他后端继续实现所需资料，重发 task 时不得丢失这些内容

## Backend executor routing
- 当前使用默认后端文档路径时，只能写 `02_handoff/backend_task.md`
- 当前使用 Node.js 风格后端文档路径时，只能写 `02_handoff/nodejs_task.md`
- 不允许同一轮同时把 `backend_task.md` 和 `nodejs_task.md` 当作当前后端目标
