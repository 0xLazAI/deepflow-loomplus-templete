# Template Lifecycle

## Purpose
本文件定义每个模板的触发 / 写入规则。
它回答四个问题：
1. 什么时候创建
2. 什么时候更新
3. 用 write 还是 append
4. 更新前至少读什么

本文件不放模板正文，不放示例正文。

## General rules
- 状态型文件默认使用 write
- 历史型文件默认使用 append
- 模板只在满足对应触发条件时使用
- 未满足触发条件时，不要提前创建或更新对应文件
- 更新文件前，必须先读取该文件的最低必读依赖
- 若文件由其他角色维护，PM 只负责读取和汇总，不主动生成
- 初始化只创建 PM 自己负责的最小文档，不为其他角色预创建占位文件
- PM 侧写入文档时，必须保留对应模板的 frontmatter、固定 section 名和顺序；缺少任一固定字段视为无效写入

## 00_meta/project_status.md
- 创建时机：
  - 新项目初始化时
- 更新时机：
  - 需求收敛后
  - handoff 发出后
  - 收到 receipt 后
  - 收到 review 后
  - 出现异常后
  - 进入 demo 阶段前
- 写入方式：
  - write
- 更新前至少读取：
  - 当前 `00_meta/project_status.md`
  - 本轮相关 canonical docs

## 00_meta/decisions.md
- 创建时机：
  - 新项目初始化时
- 追加时机：
  - 范围取舍被明确拍板
  - 默认假设被正式采用
  - 阻塞问题被拍板解决
  - review 结论导致流程改变
  - 需求方做出明确取舍
- 写入方式：
  - append
- 更新前至少读取：
  - 当前 `00_meta/project_status.md`
  - 当前轮相关 `01_product/prd.md`
  - 当前轮相关 `01_product/open_questions.md`
  - 当前轮相关 `04_review/review_summary.md`（如有）

## 00_meta/iteration_log.md
- 创建时机：
  - 新项目初始化时
- 追加时机：
  - 每轮推进结束时
- 写入方式：
  - append
- 更新前至少读取：
  - 当前 `00_meta/project_status.md`

## 01_product/requirement_brief.md
- 创建时机：
  - 新项目初始化时
- 更新时机：
  - 新需求进入时
  - 需求方修改方向时
  - 当前轮目标变化时
- 写入方式：
  - write
- 更新前至少读取：
  - 当前 `01_product/requirement_brief.md`
  - 当前 `00_meta/project_status.md`
  - `templates/requirement_brief.template.md`

## 01_product/prd.md
- 创建时机：
  - 完成第一轮需求收敛后
- 更新时机：
  - 范围变化时
  - 字段变化时
  - 规则变化时
  - handoff 前需要补齐时
- 写入方式：
  - write
- 更新前至少读取：
  - `01_product/requirement_brief.md`
  - `01_product/open_questions.md`
  - 当前 `01_product/prd.md`
  - `templates/prd.template.md`
  - `examples/prd.example.md`（如有）

## 01_product/open_questions.md
- 创建时机：
  - 完成第一轮需求收敛后
- 更新时机：
  - 出现未确认问题时
  - 有默认假设需要落盘时
  - 需求方回答问题后需要清理 / 更新时
- 写入方式：
  - write
- 更新前至少读取：
  - 当前 `01_product/open_questions.md`
  - `01_product/prd.md`
  - `templates/open_questions.template.md`

## 02_handoff/frontend_task.md
- 创建时机：
  - 首次满足 handoff 门槛时
- 更新时机：
  - 需求范围变化时
  - 默认假设变化时
  - receipt 指出 handoff 不清时
  - 合格后端回执（`backend_receipt.md` 或 `nodejs_receipt.md`）明确给出 `frontend_followup_needed=yes` 且 `frontend_followup_ready=yes`，并且当前 `frontend_followup` 已可派发时
  - 已挂起的 `frontend_followup` 在 `frontend_status=done` 后变为可派发时
  - lessons 提示需要重发 handoff 时
- 写入方式：
  - write
- 更新前至少读取：
  - `00_meta/project_status.md`
  - `01_product/requirement_brief.md`
  - `01_product/prd.md`
  - `01_product/open_questions.md`
  - 若本次更新由后端回执触发 follow-up，则必须额外读取对应后端回执中的 `frontend_followup_scope`
  - `04_review/lessons_learned.md`（仅当相关时）
  - `templates/frontend_task.template.md`
- 传递规则：
  - 若本次更新由后端回执中的 `frontend_followup_needed=yes` 且 `frontend_followup_ready=yes` 触发，则后端回执中的 `frontend_followup_scope` 必须写入 `frontend_task.md` 的 `输入依据`
  - 若 `frontend_followup_scope` 中包含链接、路径、接口说明、字段说明、调用示例或文档入口，重发 task 时不得丢失这些信息

## 02_handoff/backend_task.md
- 创建时机：
  - 首次满足 handoff 门槛时
- 更新时机：
  - 需求范围变化时
  - 默认假设变化时
  - receipt 指出 handoff 不清时
  - 合格 `frontend_receipt.md` 明确给出 `backend_followup_needed=yes` 且 `backend_followup_ready=yes`，并且当前 `backend_followup` 已可派发时
  - 已挂起的 `backend_followup` 在 `backend_status=done` 后变为可派发时
  - lessons 提示需要重发 handoff 时
- 写入方式：
  - write
- 更新前至少读取：
  - `00_meta/project_status.md`
  - `01_product/requirement_brief.md`
  - `01_product/prd.md`
  - `01_product/open_questions.md`
  - 若本次更新由前端回执触发 follow-up，则必须额外读取对应前端回执中的 `backend_followup_scope`
  - `04_review/lessons_learned.md`（仅当相关时）
  - `templates/backend_task.template.md`
- 传递规则：
  - 若本次更新由前端回执中的 `backend_followup_needed=yes` 且 `backend_followup_ready=yes` 触发，则前端回执中的 `backend_followup_scope` 必须写入 `backend_task.md` 的 `输入依据`
  - 若 `backend_followup_scope` 中包含链接、路径、接口说明、字段要求、行为约束或文档入口，重发 task 时不得丢失这些信息

## 02_handoff/nodejs_task.md
- 创建时机：
  - 首次满足 handoff 门槛，且本轮选择使用 `nodejs_task.md` 这一路径时
- 更新时机：
  - 需求范围变化时
  - 默认假设变化时
  - receipt 指出 handoff 不清时
  - 合格 `frontend_receipt.md` 明确给出 `backend_followup_needed=yes` 且 `backend_followup_ready=yes`，并且当前使用 `nodejs_task.md` 路径且 `backend_followup` 已可派发时
  - 已挂起的 `backend_followup` 在 `backend_status=done` 且当前使用 `nodejs_task.md` 路径后变为可派发时
  - lessons 提示需要重发 handoff 时
- 写入方式：
  - write
- 更新前至少读取：
  - `00_meta/project_status.md`
  - `01_product/requirement_brief.md`
  - `01_product/prd.md`
  - `01_product/open_questions.md`
  - 若本次更新由前端回执触发 follow-up，则必须额外读取对应前端回执中的 `backend_followup_scope`
  - `04_review/lessons_learned.md`（仅当相关时）
  - `templates/nodejs_task.template.md`
- 传递规则：
  - 若本次更新由前端回执中的 `backend_followup_needed=yes` 且 `backend_followup_ready=yes` 触发，则前端回执中的 `backend_followup_scope` 必须写入 `nodejs_task.md` 的 `输入依据`
  - 若 `backend_followup_scope` 中包含链接、路径、接口说明、字段要求、行为约束或文档入口，重发 task 时不得丢失这些信息

## 03_receipts/frontend_receipt.md
- 创建 / 更新责任：
  - Frontend Agent
- PM 侧动作：
  - 收到后读取
  - 校验是否满足最低标准
  - 汇总到状态层
  - 若 receipt 明确给出 `backend_followup_needed=yes` 且 `backend_followup_ready=yes`：
    - 当目标后端最近一条合格回执的 `status` 为 `done` 或 `blocked` 时，按当前后端执行代理重发后端任务文档：
      - `demo-worker` -> `02_handoff/backend_task.md`
      - `demo-worker` -> `02_handoff/nodejs_task.md`
    - 当目标后端最近一条合格回执的 `status` 不为 `done` 或 `blocked`，或当前尚无合格后端回执时，只在 `project_status.md` 中记录“backend follow-up 已挂起，等待后端当前轮可接收新任务”
  - 若本轮后端最近一条合格回执的 `status` 变为 `done` 或 `blocked`，且 `project_status.md` 中存在尚未派发的 `backend_followup`，则按当前后端执行代理重发后端任务文档（`02_handoff/backend_task.md` 或 `02_handoff/nodejs_task.md`）
  - 若通过 `/handle <projectId> <bindingId> 03_receipts/frontend_receipt.md` 触发，则按 receipt handle 流程更新：
    - `00_meta/project_status.md`
    - `00_meta/decisions.md`
    - `00_meta/iteration_log.md`
    - `04_review/lessons_learned.md`（仅当命中明确触发器）
- PM 不主动生成该文件
- 文件不存在时，PM 只在 project_status.md 中标记“等待 frontend receipt”

## 03_receipts/backend_receipt.md
- 创建 / 更新责任：
  - Backend Agent
- PM 侧动作：
  - 收到后读取
  - 校验是否满足最低标准
  - 汇总到状态层
  - 若 receipt 明确给出 `frontend_followup_needed=yes` 且 `frontend_followup_ready=yes`：
    - 当前端最近一条合格 `frontend_receipt.md` 的 `status` 为 `done` 或 `blocked` 时，立即更新并重发 `02_handoff/frontend_task.md`
    - 当前端最近一条合格 `frontend_receipt.md` 的 `status` 不为 `done` 或 `blocked`，或当前尚无合格 `frontend_receipt.md` 时，只在 `project_status.md` 中记录“frontend follow-up 已挂起，等待前端当前轮可接收新任务”
  - 若本轮前端最近一条合格回执的 `status` 变为 `done` 或 `blocked`，且 `project_status.md` 中存在尚未派发的 `frontend_followup`，则立即更新并重发 `02_handoff/frontend_task.md`
  - 若通过 `/handle <projectId> <bindingId> 03_receipts/backend_receipt.md` 触发，则按 receipt handle 流程更新：
    - `00_meta/project_status.md`
    - `00_meta/decisions.md`
    - `00_meta/iteration_log.md`
    - `04_review/lessons_learned.md`（仅当命中明确触发器）
- PM 不主动生成该文件
- 文件不存在时，PM 只在 project_status.md 中标记“等待 backend receipt”

## 03_receipts/nodejs_receipt.md
- 创建 / 更新责任：
  - demo-worker
- PM 侧动作：
  - 收到后读取
  - 校验是否满足最低标准
  - 汇总到状态层
  - 若 receipt 明确给出 `frontend_followup_needed=yes` 且 `frontend_followup_ready=yes`：
    - 当前端最近一条合格 `frontend_receipt.md` 的 `status` 为 `done` 或 `blocked` 时，立即更新并重发 `02_handoff/frontend_task.md`
    - 当前端最近一条合格 `frontend_receipt.md` 的 `status` 不为 `done` 或 `blocked`，或当前尚无合格 `frontend_receipt.md` 时，只在 `project_status.md` 中记录“frontend follow-up 已挂起，等待前端当前轮可接收新任务”
  - 若本轮前端最近一条合格回执的 `status` 变为 `done` 或 `blocked`，且 `project_status.md` 中存在尚未派发的 `frontend_followup`，则立即更新并重发 `02_handoff/frontend_task.md`
  - 若通过 `/handle <projectId> <bindingId> 03_receipts/nodejs_receipt.md` 触发，则按 receipt handle 流程更新：
    - `00_meta/project_status.md`
    - `00_meta/decisions.md`
    - `00_meta/iteration_log.md`
    - `04_review/lessons_learned.md`（仅当命中明确触发器）
- PM 不主动生成该文件
- 文件不存在时，PM 只在 project_status.md 中标记“等待 nodejs receipt”

## 04_review/review_summary.md
- 创建 / 更新责任：
  - Reviewer / QA
- PM 侧动作：
  - 收到后读取
  - 汇总到状态层
- PM 不主动生成该文件
- 文件不存在时，PM 不得声称“已 review”
- 文件不存在本身不阻塞流程

## 04_review/unresolved_issues.md
- 创建 / 更新责任：
  - Reviewer / QA
- PM 侧动作：
  - 收到后读取
  - 判断是否阻塞
  - 汇总到状态层
- PM 不主动生成该文件
- 文件不存在时，PM 只按已有 review_summary 或其他已知状态同步，不得补写占位问题单
- 文件不存在本身不阻塞流程

## 04_review/lessons_learned.md
- 创建时机：
  - 新项目初始化时
- 追加时机：
  - 同类 handoff 缺字段第二次出现
  - 同类 receipt 缺最低字段第二次出现
  - 默认假设未落盘再次出现
  - review 缺明确结论第二次出现
  - review / gate 失效且同类问题再次出现
- 写入方式：
  - append
- 更新前至少读取：
  - 当前 `04_review/lessons_learned.md`
  - 当前轮相关 `00_meta/iteration_log.md`
  - 当前轮相关 `04_review/review_summary.md`（如有）
- 不追加的情况：
  - 首次出现的零碎 bug
  - 单次偶发沟通问题
  - 尚未构成重复模式的问题

## 05_delivery/current_demo.md
- 创建时机：
  - 首次满足 demo 门槛时
- 更新时机：
  - 当前轮已有可供需求方 review 的阶段性结果时
- 写入方式：
  - write
- 更新前至少读取：
  - `00_meta/project_status.md`
  - 当前轮相关 handoff / receipt / 已存在的 review 结果
  - `templates/current_demo.template.md`
- 注意：
  - 仅有 PRD、task、receipt 或口头进度说明，不足以构成 demo
  - 初始化阶段不得预创建 current_demo.md
