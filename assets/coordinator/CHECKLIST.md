# Main Coordinator Checklist

## Purpose
本文件用于检查当前轮协调流程是否满足推进条件。
它不是说明文档，而是阶段门禁表。
若关键项未满足，不得继续推进到下一阶段。

## A. 项目初始化阶段
- [ ] 已确认或生成 project code
- [ ] 已 bind 当前 project
- [ ] 已初始化 canonical docs
- [ ] 已创建 `00_meta/project_status.md`
- [ ] 已创建 `01_product/requirement_brief.md`
- [ ] 已创建 `00_meta/decisions.md`
- [ ] 已创建 `00_meta/iteration_log.md`
- [ ] 未预创建 receipt / review / demo 文件
- [ ] 已向外部对口人同步“项目已初始化”
- [ ] 上述“已初始化”结论基于 docs-manager 成功执行并验证，而不是口头推断

## B. 需求澄清阶段
- [ ] 已识别本次输入类型
- [ ] 已明确当前轮目标
- [ ] 已明确最小 MVP 范围
- [ ] 已列出未确认问题
- [ ] 已判断哪些问题会阻塞当前执行链路
- [ ] 已更新 `01_product/prd.md`
- [ ] 已更新 `01_product/open_questions.md`
- [ ] 默认假设已落盘
- [ ] `requirement_brief.md` / `prd.md` / `open_questions.md` 已保留模板 frontmatter
- [ ] `requirement_brief.md` / `prd.md` / `open_questions.md` 已保留模板固定 section 名与顺序

## C. handoff 门禁
进入 handoff 前，以下条件必须全部满足：
- [ ] 当前轮目标明确
- [ ] 最小 MVP 范围明确
- [ ] 未确认问题已列出
- [ ] 已判断阻塞项
- [ ] 已能区分不同 handoff 通道的 scope

## D. handoff 生成阶段
- [ ] 已生成 `02_handoff/frontend_task.md`
- [ ] 已按后端执行代理生成后端任务文档：
  - `demo-worker` 可接收 `02_handoff/backend_task.md`
  - `demo-worker` 也可接收 `02_handoff/nodejs_task.md`
- [ ] frontend_task / 后端任务文档 已保留模板 frontmatter
- [ ] frontend_task / 后端任务文档 已保留模板固定 section 名与顺序
- [ ] frontend_task 至少包含：
  - [ ] 目标
  - [ ] 范围
  - [ ] 输入依据
  - [ ] 联动输入
  - [ ] 默认假设
  - [ ] 输出要求
- [ ] backend_task 至少包含：
  - [ ] 目标
  - [ ] 范围
  - [ ] 输入依据
  - [ ] 联动输入
  - [ ] 默认假设
  - [ ] 输出要求
- [ ] 若使用 `nodejs_task.md` 路径，仍由 `demo-worker` 执行，结构约束与 `backend_task.md` 保持一致
- [ ] 已更新 `00_meta/project_status.md`
- [ ] 已向外部对口人同步“handoff 已发出”

## E. 回执收集阶段
- [ ] 已检查 `03_receipts/frontend_receipt.md`
- [ ] 已按后端执行代理检查后端回执：
  - `demo-worker` 可写回 `03_receipts/backend_receipt.md`
  - `demo-worker` 也可写回 `03_receipts/nodejs_receipt.md`
- [ ] 未收到的 receipt 已在 `00_meta/project_status.md` 中显式标记为等待
- [ ] frontend_receipt 至少包含：
  - [ ] 当前状态
  - [ ] 当前可推进内容
  - [ ] 当前问题
  - [ ] 当前阻塞
  - [ ] 当前产出
  - [ ] 后端联动信号
- [ ] backend_receipt 至少包含：
  - [ ] 当前状态
  - [ ] 当前可推进内容
  - [ ] 当前问题
  - [ ] 当前阻塞
  - [ ] 当前产出
  - [ ] 前端联动信号
- [ ] 若使用 `nodejs_receipt.md` 路径，仍按与 `backend_receipt.md` 相同的字段约束填写
- [ ] 已把 receipt 汇总到 `00_meta/project_status.md`
- [ ] 已把关键结论写入 `00_meta/decisions.md`
- [ ] 已更新 `00_meta/iteration_log.md`
- [ ] 若任一 receipt 明确给出对侧 `followup_needed=yes` 且 `followup_ready=yes`，已判断是“立即重发对侧 task”还是“先挂起等待对侧完成”
- [ ] 若某侧本轮完成且存在该侧挂起的 follow-up，已更新并重发对应的 `02_handoff/*_task.md`
- [ ] 已向外部对口人同步当前推进情况
- [ ] 若 receipt 通过 `/handle` 处理，已将系统协议返回与需求方通知拆成两条独立输出
- [ ] 若 receipt 通过 `/handle` 处理，已执行 owner-notify check；若需通知，则在通知发出前本轮 `/handle` 不算完整完成
- [ ] 未把缺失或不合格 receipt 当作正式推进依据

## F. review 阶段（如有）
- [ ] 已检查当前已存在的 review 文件
- [ ] 已将 review 结论汇总到 `00_meta/project_status.md`
- [ ] 已将关键 review 结论写入 `00_meta/decisions.md`
- [ ] 已更新 `00_meta/iteration_log.md`
- [ ] 已向需求方同步 review 关键结论
- [ ] 未把缺失或无明确结论的 review 当作已通过
- [ ] 未因缺失 review 文件而阻塞正常推进

## G. lessons 阶段
仅在出现重复错误或流程性错误时执行：
- [ ] 已判断是否出现重复错误
- [ ] 已判断是否出现流程性错误
- [ ] 已判断是否命中以下明确触发器之一：
  - 同类 handoff 缺字段第二次出现
  - 同类 receipt 缺最低字段第二次出现
  - 默认假设未落盘再次出现
  - review 缺明确结论第二次出现
  - review / gate 失效再次出现
- [ ] 若有，已更新 `04_review/lessons_learned.md`
- [ ] lessons 记录的是机制性问题，而不是所有零碎 bug

## H. demo 门禁
进入 demo 前，以下条件必须成立：
- [ ] 已有可供需求方 review 的阶段性结果
- [ ] 当前可展示结果不是只有 PRD / task / receipt / 口头进度
- [ ] 已更新 `05_delivery/current_demo.md`
- [ ] `current_demo.md` 已保留模板 frontmatter
- [ ] `current_demo.md` 已保留模板固定 section 名与顺序
- [ ] 已明确需求方本轮重点看什么

## I. 对外反馈
- [ ] 头部已包含项目已绑定
- [ ] 头部已包含项目密码
- [ ] 头部已包含项目文档链接（若不可用已说明原因）
- [ ] 当前状态已说明
- [ ] 已推进内容已说明
- [ ] 待确认问题已说明
- [ ] 下一步已说明
- [ ] 未把内部文件名、原始 stage 枚举值或 `next_action=...` 直接当作主叙事输出
- [ ] 已明确区分阻塞性待确认问题与非阻塞待确认问题
- [ ] 若超过 5 分钟无新用户可见事件，已发送简短状态更新

## I1. Owner-visible events
- [ ] 本轮关键动作完成后，已执行 owner-notify check
- [ ] owner-notify check 已比较更新前后的 `project_status.md`
- [ ] 若 `stage` / `frontend_status` / `backend_status` / `needs_owner_action` 任一字段发生变化，已发送独立需求方通知
- [ ] 若本轮首次收到 `frontend_receipt.md` 的合格回执，已发送独立需求方通知
- [ ] 若本轮首次收到后端合格回执（`backend_receipt.md` 或 `nodejs_receipt.md`），已发送独立需求方通知
- [ ] 若本轮成功更新 `05_delivery/current_demo.md`，已发送独立需求方通知
- [ ] 若 owner-notify check 判定需要通知，在独立需求方通知发出前，不得视为本轮已完整完成

## J. Blocking exceptions
以下情况默认阻塞：
- [ ] project 未 bind
- [ ] canonical docs 未初始化
- [ ] handoff 不满足门槛
- [ ] handoff 缺最低字段
- [ ] receipt 不满足最低标准
- [ ] receipt 或 review 缺失但被错误当成已收到
- [ ] review 明确指出阻塞性问题
- [ ] 关键需求未确认且影响主流程
- [ ] 当前输入明确属于另一个项目

若任一项成立：
- [ ] 已更新 `00_meta/project_status.md`
- [ ] 已记录 `00_meta/iteration_log.md`
- [ ] 已向需求方说明阻塞和下一步

## K. 严禁事项
- [ ] 不允许无 bind 直接写项目文档
- [ ] 不允许不落盘推进项目
- [ ] 不允许无合格 handoff 进入开发
- [ ] 不允许无合格 receipt 宣称开发完成
- [ ] 不允许把未确认问题当已确认
- [ ] 不允许跳过 `00_meta/project_status.md` 更新
- [ ] 不允许把外部输入原话直接丢给执行通道充当 handoff
- [ ] 不允许 `coordinator` 伪造 receipt / review / demo 占位文件
- [ ] 不允许在 docs-manager 未成功写入并验证前，声称文档已创建或已更新
- [ ] 不允许直接读取 canonical 相对路径（如 `00_meta/...`、`01_product/...`）；必须先通过 `/locate` 获取绝对路径再读取
- [ ] 不允许执行 `docs-manager ...` 裸命令；如需执行命令，必须调用 `docs-manager-executor.mjs` 且仅使用命名参数
- [ ] 不允许擅自改写模板的 frontmatter、固定标题或字段顺序
