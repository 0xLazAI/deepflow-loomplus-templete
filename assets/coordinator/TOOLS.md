# TOOLS

## Purpose
你通过 docs-manager 管理当前项目的 canonical docs。
所有项目文档操作都必须走 docs-manager。
不要绕过 docs-manager 直接操作文件。

`loomplus` 相关操作、工具名和参数参考统一以 `/tmp/deepflow-assets/loom-tools.md` 为准。
`loomplus` 的 project / mission / coordination issue 方法与 payload 细节，还要对齐 `/home/ubuntu/loomcli/docs/modules/05-projects-missions-and-coordination.md`。

agent 间消息、owner notify 和基于 binding 的直接消息发送，统一走 `agent-messenger`。

关键约束：
- `docs-manager` 是 skill 名称，不是 shell 可执行命令。
- 不允许执行 `docs-manager ...`。
- 若需要执行命令，必须使用 `node ~/.openclaw/skills/docs-manager/docs-manager-executor.mjs --action <action> --binding-id <bindingId> ...`（只允许命名参数）。

## Loomplus runtime calls
普通需求输入不是只写 docs，还必须同步到 `loomplus` runtime。

用户身份查询与绑定相关方法，参考 `/home/ubuntu/loomcli/docs/modules/03-identity-and-binding.md`。

标准顺序：
1. 先确认当前需求对应的 `loomplus` project 是否存在
2. 若不存在，调用 `get_project_id_by_name` 或 `list_projects` 检查后，再调用 `create_project`
3. 对本轮需求创建或更新 `coordination issue`
4. 若本轮需求已经明确到可执行任务，再创建或更新 `mission`
5. 后续状态推进时，按实际进展更新 project / coordination issue / mission 状态

默认规则：
- 新需求：至少同步 `project` + `coordination issue`
- 已有项目下的新一轮明确执行项：再同步 `mission`
- 纯进度同步、推进、关闭：使用 `update_project_status`、`update_coordination_issue`、`update_mission`
- 纯 docs-manager command-style 指令、`/handle`、`/notify-owner`：不强制走上述需求接入链路

推荐方法：
- project 查询：`loom run get_project_id_by_name --json '{"name":"Project Alpha"}'`
- project 创建：`loom run create_project --json '{"name":"Project Alpha","description":"CLI created"}'`
- coordination 创建：`loom run create_coordination_issue --json '{"projectId":"project_xxx","title":"Daily sync follow-up","summary":"Short summary","type":"COORDINATION_START","sourceInput":"Original incoming text","content":{"telegramChatId":"-1001234567890"}}'`
- mission 创建：`loom run create_mission --json '{"projectId":"project_xxx","title":"Ship feature","description":"Optional mission description","assigneeEmail":"owner@example.com","assigneePlatform":"telegram","assigneePlatformId":"123456","deadline":"2026-04-14","priority":"P2"}'`

需求接入规则：
- 当用户首次提出一个新需求时，必须先做 project 查询；没有匹配 project 时创建 project
- 接住需求后，必须创建或更新 coordination issue，至少带上 `title`、`summary`、`type`、`sourceInput` 与 `projectId`
- 若当前会话是 Telegram 群，创建 coordination issue 时必须在 `content.telegramChatId` 写入当前群 `chat id`
- 若需求已经明确拆成可执行动作，再创建 mission；不要在需求仍模糊时过早创建大量 mission
- 若 mission 已经明确负责人，创建或更新 mission 时必须写入 assignee 字段，不得创建“已知负责人但未 assign”的 mission
- mission assignee 字段优先级：`assigneeId` > `assigneeEmail`，若负责人来自 Telegram/Slack 等外部账号，再补 `assigneePlatform` 与 `assigneePlatformId`
- 可用状态值、priority 和 issue type 只能使用文档中允许的枚举值；不要自造值
- 不得只说“已同步到 loomplus”而没有实际执行对应 `loom run ...` 调用

## Loomplus identity and binding calls
当需要根据 Telegram、邮箱或批量平台账号查找用户时，必须使用 `loom` 的 identity / binding 方法，不要自行猜测 Loom+ 用户身份。

推荐方法：
- 绑定外部账号：`loom run bind_user_info --json '{"bindingCode":"your_binding_code","platform":"telegram","platformId":"123456"}'`
- 按单个外部账号查邮箱：`loom run get_user_email_by_platform_id --json '{"platform":"telegram","platformId":"123456"}'`
- 按多个外部账号批量查邮箱：`loom run get_user_emails_by_ids --json '{"platform":"telegram","ids":["123456","789012"]}'`
- 按外部账号查已分配任务：`loom run list_assigned_missions_by_platform_id --json '{"platform":"telegram","platformId":"123456"}'`

使用规则：
- 已知 Telegram 用户 id、Slack 用户 id 等外部平台身份时，优先用 `get_user_email_by_platform_id`
- 当输入里出现 Telegram `@username` 且该人是 mission 负责人时，必须先主动解析该 `@username` 对应的 Telegram 数字 id，再继续做 Loom 绑定查询；不能直接停在“请提供 id”
- 需要一次查多个 Telegram 或其他平台用户时，用 `get_user_emails_by_ids`
- 需要确认某个外部账号当前领到哪些 mission 时，用 `list_assigned_missions_by_platform_id`
- 若只有邮箱、没有平台 id，不要伪造 platform lookup 结果；只能基于已知 loomplus 数据继续推进
- `platform` 只能使用文档允许的枚举值，如 `telegram`、`wechat`、`slack`、`discord`
- 未基于实际 `loom run ...` 返回结果，不得声称已识别某个 Telegram 用户对应的 Loom+ 邮箱或任务归属
- 已完成用户查询且能稳定定位负责人时，后续 `create_mission` 或 `update_mission` 必须把查询结果映射到 assignee 字段，而不是只在自然语言里提到负责人名字
- 若 Telegram `@username` 已经成功解析出数字 id，必须继续尝试 `get_user_email_by_platform_id` 并更新 mission assignee，不得回复“缺少绑定信息”后提前结束
- 若明确需要 assign，但当前确实查不到 Loom+ 身份或绑定结果，必须显式说明 mission 暂未 assign 的原因，不能默默创建未指派 mission
- 只有在 Telegram `@username` 解析失败、且基于 `platformId` / 邮箱的 Loom 绑定查询也失败时，才允许保留未 assign mission

示例：
- 用户说“帮我跟进今晚热点，明早前给一版英文 thread、一版中文解读和封面图”
  - 先确认或创建 project
  - 再创建一个 `type=COORDINATION_START` 的 coordination issue
  - 若已经明确了具体交付项和截止时间，再创建对应 mission
- 用户说“这个任务给 Telegram 上的 Jerry 负责”，且已查到 `platformId=123456` 对应邮箱
  - 先用 `get_user_email_by_platform_id` 查到邮箱
  - 再在 `create_mission` 或 `update_mission` 中写入 `assigneeEmail`、`assigneePlatform=telegram`、`assigneePlatformId=123456`
- 用户说“@lumersgo 负责推进基座和 agent 编排”
  - 先主动解析 `@lumersgo` 的 Telegram 数字 id
  - 若解析成功，立即用该 `platformId` 调 `get_user_email_by_platform_id`
  - 若 Loom 绑定存在，则在同一轮里完成 mission assign，不要再向需求方追问 Telegram id
- 用户只是问“现在进度到哪了”
  - 优先读取当前 docs 与已有 loomplus 状态；若只是汇报，不必新建 mission

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
