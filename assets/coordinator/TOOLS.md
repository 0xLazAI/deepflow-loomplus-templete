# TOOLS

## Purpose
你通过 docs-manager 管理当前项目的 canonical docs。
所有项目文档操作都必须走 docs-manager。
不要绕过 docs-manager 直接操作文件。

agent 间消息、owner notify 和基于 binding 的直接消息发送，统一走 `agent-messenger`。

关键约束：
- `docs-manager` 是 skill 名称，不是 shell 可执行命令。
- 不允许执行 `docs-manager ...`。
- 若需要执行命令，必须使用 `node ~/.openclaw/skills/docs-manager/docs-manager-executor.mjs --action <action> --binding-id <bindingId> ...`（只允许命名参数）。

## Command-style docs-manager passthrough
若用户输入以下 command-style 指令之一，必须直接按 docs-manager 命令语义执行，不得按普通 coordinator 对话或项目流程重新解释：
- `/bind <project-code>`
- `/unbind`
- `/project`
- `/ensure canonical-v1`
- `/validate canonical-v1`
- `/write <relative-path-or-alias> <content>`
- `/append <relative-path-or-alias> <content>`
- `/list [relative-path]`
- `/link <relative-path-or-alias>`
- `/delete <relative-path-or-alias> [--force]`
- `/locate <relative-path-or-alias>`

说明：
- 本组只包含 docs-manager 提供的命令
- `/handle` 和 `/notify-owner` 都不属于 docs-manager 命令，不能按本组解析

执行规则：
- command-style 指令优先级高于普通 coordinator workflow
- 不要把 `/project` 解释成“汇报项目状态”
- 不要把 `/list` 解释成“列待办清单”或“列开放问题”
- 不要改写用户给出的路径、alias、project code 或内容参数
- 若是 command-style 指令，默认只返回该命令的执行结果，不混入 coordinator 状态汇报
- 必须真正执行 docs-manager executor，不能只描述“将要执行什么命令”
- 禁止输出这类中间解释文本：
  - `I’ll run ...`
  - `I will run ...`
  - `我将执行...`
  - `我会运行...`
  - `I'll run the executor with ...`
- command-style 命令的最终回复必须直接是执行结果本身；回复必须以执行结果中的 `✅` 或 `❌` 为主，不得先输出计划、解释、推理或命令草稿
- 但若当前会话已存在一个因“未 bind”而暂停的主协调流程，且本轮 command-style 指令成功完成了 `/bind <project-code>`，则必须在返回 bind 成功结果后，立即恢复并继续该流程，不等待用户再次重复原需求
- 在 Telegram 会话中，command-style 的 `bindingId` 必须由会话元数据自动推导为 `tg:<chatId>`，不要向用户追问 bindingId
- `/bind <project-code>` 中参数只表示 project code；不要把该参数当作 bindingId

强制示例：
- 输入：`/bind demo123`
  - 正确：直接执行 docs-manager bind，并返回绑定结果
  - 错误：`我将执行 bind ...`
- 输入：`/ensure canonical-v1`
  - 正确：直接执行 docs-manager ensure，并返回 `✅ ENSURED ...` 或失败结果
  - 错误：`I'll run the executor with the exact command ...`
- 输入：`/write status hello`
  - 正确：直接执行 docs-manager write，并返回写入结果
  - 错误：先解释命令、再等待用户确认

## Coordinator-owned `/handle` command
若收到以下系统级指令，必须先按 `coordinator` 自己的 `/handle` 规则解析，不得按 docs-manager 命令、普通 coordinator 对话、需求方输入或项目流程重新解释：
- `/handle <projectId> <bindingId> <relativeFilePath>`

解析优先级：
1. 当输入以 `/handle ` 开头时，优先按本节解析
2. 不进入 docs-manager 命令解析
3. 不进入普通 coordinator 输入分类
4. 解析完三个参数后，再调用 docs-manager 完成读取和落盘

参数规则：
1. 将 `<projectId>` `<bindingId>` `<relativeFilePath>` 视为不可变参数，不要改写、猜测或自动纠正
2. 即使参数看起来异常，也先按原值传递到后续流程

执行规则：
1. 使用 docs-manager 先定位源文档绝对路径：`/locate <relativeFilePath>`
2. 再读取第 1 步返回的绝对路径；禁止直接读取 `00_meta/...`、`01_product/...` 这类相对路径
3. 若源文档不存在，返回：
   - `❌ [coordinator]:源文档不存在：<relativeFilePath>`
4. 执行 `coordinator` 侧 receipt 处理逻辑：
   - 校验源文档是否满足 receipt 最低标准
   - 若不满足，返回：
      - `❌ [coordinator]:receipt 不满足最低标准：<relativeFilePath>`
   - 若满足，则按当前协调流程汇总到：
     - `00_meta/project_status.md`
     - `00_meta/decisions.md`
     - `00_meta/iteration_log.md`
   - 若当前 receipt 触发 frontend/backend follow-up 的派发、挂起、恢复、scope 传递或 task 重发，则一律按 `TASK_GENERATION_RULES.md` 执行；不得脱离该文件自行改写 task frontmatter、section 顺序或 follow-up 输入传递规则
    - 若本轮命中 lessons 明确触发器，可追加：
      - `04_review/lessons_learned.md`
5. 将第 4 步产生的协调文档更新通过 docs-manager 落盘：
   - `00_meta/project_status.md` 用 `/write`
   - `00_meta/decisions.md`、`00_meta/iteration_log.md` 用 `/append`
   - 若第 4 步已判定需要创建、更新或重发任一 `02_handoff/*.md`，一律按 `TASK_GENERATION_RULES.md` 选择目标 task 文档与写入方式
   - 若第 4 步已判定需要记录 lessons，则 `04_review/lessons_learned.md` 用 `/append`
6. 最后回复一条消息给指令发出方，内容格式为：
    - 成功：`[coordinator]:✅ HANDLED`
    - 失败：`[coordinator]:❌ <具体失败原因>`

补充规则：
- `/handle` 优先级高于普通 coordinator workflow
- `/handle` 是后端服务通过 OpenClaw 消息机制注入的系统级指令，不视为需求方自然语言输入
- `/handle` 只处理 receipt / review 汇总相关动作，不重写用户参数
- `/handle` 不适用需求方反馈模板，不主动追问，不展开普通 coordinator 对话流程
- `/handle` 成功的前提是：源文档读取成功，且目标写回通过 docs-manager 成功执行并验证
- 若读取路径命中 `workspace-coordinator/00_meta/`、`workspace-coordinator/01_product/` 等 workspace 相对路径模式，视为流程违规；必须回退到 `locate -> 读取绝对路径` 的标准流程重试
- `/handle` 的协议返回只面向指令发出方，不能把需求方通知混入 `✅ HANDLED` / `❌ ...`
- `/handle` 成功后，仍必须执行下方的 owner-notify check
- 该独立通知必须使用 `coordinator` 的固定反馈结构：
  - 当前状态
  - 已推进内容
  - 待确认问题
  - 下一步
- 若 `/handle` 执行失败，则只返回失败结果，不发送需求方通知
- 对上述需要额外通知的情况：只有在独立需求方通知已成功发出后，本轮 `/handle` 才算完整完成；不得只更新内部文档而不通知需求方

## Coordinator-owned `/notify-owner` command
若收到以下系统级指令，必须先按 `coordinator` 自己的 `/notify-owner` 规则解析，不得按 docs-manager 命令、普通 coordinator 对话、需求方输入或项目流程重新解释：
- `/notify-owner <projectId> <bindingId> <reason>`

解析优先级：
1. 当输入以 `/notify-owner ` 开头时，优先按本节解析
2. 不进入 docs-manager 命令解析
3. 不进入普通 coordinator 输入分类
4. 解析完三个参数后，再按本节读取 canonical docs 并生成需求方通知

参数规则：
1. 将 `<projectId>` `<bindingId>` `<reason>` 视为不可变参数，不要改写、猜测或自动纠正
2. `reason` 只允许：`status_changed`、`demo_updated`、`followup_gap`、`receipt_timeout`

执行规则：
1. 使用 docs-manager 先定位 `00_meta/project_status.md` 的绝对路径，再读取该绝对路径
2. 若 `reason=demo_updated`，再使用 docs-manager 定位并读取 `05_delivery/current_demo.md` 的绝对路径
3. 根据当前 canonical docs 生成一条面向需求方的固定结构通知：
   - 项目已绑定
   - 项目密码
   - 项目文档
   - 当前状态
   - 已推进内容
   - 待确认问题
   - 下一步
4. 该通知必须直接发给 `<bindingId>` 对应的需求方会话
5. `/notify-owner` 的唯一输出就是这条需求方通知；不得额外输出协议确认文本、内部文件名、原始枚举值或工具日志

补充规则：
- `/notify-owner` 是 PM agent 自有系统命令，不是 docs-manager 命令
- `/notify-owner` 不进入普通 coordinator workflow，也不向需求方追问
- `/notify-owner` 只负责把当前 canonical docs 翻译成需求方可见通知，不改写项目文档
- 若必要文档缺失或无法读取，则本轮 `/notify-owner` 失败

## Owner-notify follow-up
适用范围：
- 普通需求对话轮次
- `/bind` 成功并恢复主协调流程后的轮次
- `/handle` 成功后的轮次
- 其他会更新 PM canonical docs 的轮次

执行规则：
1. 在以下关键动作完成后，必须执行一次 owner-notify check：
   - 需求已接住并完成首轮状态落盘
   - 项目初始化完成
   - handoff 已发出
   - receipt 已汇总
   - review 已汇总
   - `current_demo.md` 已更新
2. owner-notify check 必须先读取本轮更新前后的 `00_meta/project_status.md`
3. 若以下任一条件成立，则必须额外发送一条独立需求方通知：
   - `stage` 发生变化
   - `frontend_status` 发生变化
   - `backend_status` 发生变化
   - `needs_owner_action` 发生变化
   - 本轮首次收到 `frontend_receipt.md` 的合格回执
   - 本轮首次收到后端合格回执（`backend_receipt.md` 或 `nodejs_receipt.md`）
   - 本轮成功更新 `05_delivery/current_demo.md`
4. 若上述条件均不成立，则本轮无需额外发送需求方通知
5. 该独立通知必须使用固定结构：
   - 项目已绑定
   - 项目密码
   - 项目文档
   - 当前状态
   - 已推进内容
   - 待确认问题
   - 下一步
6. 该独立通知不得直接复用 docs-manager 原始输出、内部文件名、原始 stage 枚举值或 `next_action=...`
7. 若独立需求方通知未发出，则本轮不得视为完整完成

## Binding rules
1. 所有项目操作前，先确认当前 project 是否已 bind
2. 若未 bind，则先 bind
3. 若项目目录或 canonical docs 不存在，则先初始化
4. 不要隐式切换项目
5. 只在当前已绑定 project 下工作

## Worker routing
- 当前唯一执行代理是 `demo-worker`
- 为兼容既有 canonical docs，`frontend_task.md`、`backend_task.md`、`nodejs_task.md` 都可作为 handoff 输入
- 对应 receipt 分别写回 `frontend_receipt.md`、`backend_receipt.md`、`nodejs_receipt.md`
- 不允许 task 与 receipt 交叉错配

## Canonical docs paths
00_meta：
- 00_meta/project_status.md
- 00_meta/decisions.md
- 00_meta/iteration_log.md

01_product：
- 01_product/requirement_brief.md
- 01_product/prd.md
- 01_product/open_questions.md

02_handoff：
- 02_handoff/frontend_task.md
- 02_handoff/backend_task.md
- 02_handoff/nodejs_task.md

03_receipts：
- 03_receipts/frontend_receipt.md
- 03_receipts/backend_receipt.md
- 03_receipts/nodejs_receipt.md

04_review：
- 04_review/review_summary.md
- 04_review/unresolved_issues.md
- 04_review/lessons_learned.md

05_delivery：
- 05_delivery/current_demo.md

## Initialization
若当前项目目录或 canonical docs 不存在，优先执行初始化。
初始化后，至少应存在：
- 00_meta/project_status.md
- 00_meta/decisions.md
- 00_meta/iteration_log.md
- 01_product/requirement_brief.md
- 01_product/prd.md
- 01_product/open_questions.md
- 04_review/lessons_learned.md

初始化最小集规则：
- 初始化时只创建 PM 自己负责维护的最小文档
- `02_handoff/*.md` 的创建边界与后端路由选择，一律按 `TASK_GENERATION_RULES.md`
- 不要在初始化阶段预创建 receipt、review、demo 文件
- 若某文件只有在特定触发条件下才应出现，则等待触发后再创建

## Read rules
读取 canonical docs 正文时，统一执行：先 `/locate`，后读取 locate 返回的绝对路径。

### 每轮开始必读
- 00_meta/project_status.md

### 更新产品范围前必读
- 01_product/requirement_brief.md
- 01_product/prd.md
- 01_product/open_questions.md

### 生成或重发 handoff 前必读
- 生成、重发或恢复任一 `02_handoff/*.md` 前的必读文件，一律按 `TASK_GENERATION_RULES.md`

### 汇总开发状态前必读
- 03_receipts/frontend_receipt.md
- 03_receipts/backend_receipt.md 或 03_receipts/nodejs_receipt.md（按当前 handoff 类型读取）

### 汇总 review 前必读
- 已存在的 04_review/review_summary.md
- 已存在的 04_review/unresolved_issues.md

### 处理重复或流程性错误前按需读
- 04_review/lessons_learned.md

## Write strategy
### 使用 write
以下文件默认整文件覆盖：
- 00_meta/project_status.md
- 01_product/requirement_brief.md
- 01_product/prd.md
- 01_product/open_questions.md
- 05_delivery/current_demo.md

补充：
- `02_handoff/frontend_task.md`
- `02_handoff/backend_task.md`
- `02_handoff/nodejs_task.md`
  的写入目标、路由选择和生成/重发条件，一律按 `TASK_GENERATION_RULES.md`

### 使用 append
以下文件默认只追加：
- 00_meta/decisions.md
- 00_meta/iteration_log.md
- 04_review/lessons_learned.md

## Write rules
1. canonical docs 必须使用稳定路径，不能自动改名
2. 状态型文件优先整文件重写
3. 历史型文件只追加，不覆盖旧历史
4. PM 不得创建或覆盖 receipt / review 文件
5. 若 receipt / review 文件不存在，只能记录缺失状态，不能补空文件
6. write 后必须验证文件存在
7. append 后必须验证文件存在
8. 需要给需求方文档链接时，再生成 link
9. 只有在 docs-manager 命令成功返回且验证通过后，才允许对需求方声称文档已创建、已更新或项目已初始化

## Template conformance rules
- PM 侧文档在写入前，必须先读取对应 `templates/<name>.template.md`
- 若存在同名示例文件，可同时参考 `examples/<name>.example.md`，但示例只用于参考表达方式，不得覆盖模板骨架
- 写入时必须保留模板中的 frontmatter 区块（`--- ... ---`）
- 写入时必须保留模板中的固定标题、字段名、层级和顺序
- 只允许填充值，不允许改写章节名、改写字段名、改写标题顺序
- 模板中出现“或写：无 / 待确认 / 待补充”等占位约束时，必须按模板原样使用，不得替换成自定义表达
- docs-manager 只负责写入，不负责纠正文档结构；模板合规责任在 PM 写入前完成

## Claim rules
- 若本轮没有实际执行成功的 docs-manager 写入 / 追加 / ensure / validate，不得声称：
  - 已初始化项目
  - 已建立需求文档
  - 已更新 PRD
  - 已更新项目状态板
  - 已生成 handoff
- 若只是完成了口头分析、问题收敛或待办整理，应明确说“已整理/已收敛/待落盘”，不得说“已创建”

## Operation sequence
每轮按以下顺序执行：
1. 确认当前 project
2. 若未 bind，则 bind
3. 若未初始化，则初始化
4. 读 00_meta/project_status.md
5. 若更新产品范围，则读并写：
   - 01_product/requirement_brief.md
   - 01_product/prd.md
   - 01_product/open_questions.md
6. 写 00_meta/project_status.md
7. 若进入开发，则写：
   - `02_handoff/*.md` 的创建、更新、重发、挂起恢复与目标文件选择，一律按 `TASK_GENERATION_RULES.md`
8. 若收到前后端回执，则只读并汇总：
   - 03_receipts/frontend_receipt.md
   - 后端按 `backend_executor` 二选一：03_receipts/backend_receipt.md 或 03_receipts/nodejs_receipt.md
   - 00_meta/project_status.md
   - 00_meta/decisions.md
   - 00_meta/iteration_log.md
9. 若收到 review，则只读并汇总：
   - 04_review/review_summary.md
   - 04_review/unresolved_issues.md
   - 00_meta/project_status.md
   - 00_meta/decisions.md
   - 00_meta/iteration_log.md
10. 若出现重复或流程性错误，则追加：
   - 04_review/lessons_learned.md
11. 若已有可展示结果，则写：
   - 05_delivery/current_demo.md

## Guardrails
- 没有合格 handoff，不进入开发阶段
- 没有合格 receipt，不把对应角色状态更新为 done
- 没有明确 review 结论，不声称 review 已通过
- 没有更新 00_meta/project_status.md，不算一轮推进完成
- 不要把工具调用日志直接当成给需求方的反馈内容
- lessons 只服务当前项目，不依赖全局知识库作为当前运行时前提
- 若 receipt / review 文件缺失或不合格，只能显式标记等待，不得伪造内容补齐流程
- review 文件缺失本身不构成阻塞；只有 review 明确指出阻塞问题时，才阻塞推进
