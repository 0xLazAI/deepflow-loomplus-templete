# Templates

## Purpose
本文件是模板索引和示例索引，不放长模板正文。
模板正文放在 `templates/` 目录下。
示例文件放在 `examples/` 目录下。
这样可以避免单文件过长，同时让模型知道正确模板和示例在哪里。
与 FE / BE receipt 填写和联调信号相关的说明，单独放在 `RECEIPT_FILLING_GUIDE.md`。

## Template files
当前角色使用以下模板文件：

- `templates/project_status.template.md`
- `templates/decisions.template.md`
- `templates/iteration_log.template.md`
- `templates/requirement_brief.template.md`
- `templates/prd.template.md`
- `templates/open_questions.template.md`
- `templates/frontend_task.template.md`
- `templates/backend_task.template.md`
- `templates/nodejs_task.template.md`
- `templates/frontend_receipt.template.md`
- `templates/backend_receipt.template.md`
- `templates/nodejs_receipt.template.md`
- `templates/review_summary.template.md`
- `templates/unresolved_issues.template.md`
- `templates/lessons_learned.template.md`
- `templates/current_demo.template.md`

## Example files
若存在同名示例文件，则同时参考以下示例：

- `examples/project_status.example.md`
- `examples/decisions.example.md`
- `examples/iteration_log.example.md`
- `examples/requirement_brief.example.md`
- `examples/prd.example.md`
- `examples/open_questions.example.md`
- `examples/frontend_task.example.md`
- `examples/backend_task.example.md`
- `examples/nodejs_task.example.md`
- `examples/frontend_receipt.example.md`
- `examples/backend_receipt.example.md`
- `examples/nodejs_receipt.example.md`
- `examples/review_summary.example.md`
- `examples/unresolved_issues.example.md`
- `examples/lessons_learned.example.md`
- `examples/current_demo.example.md`

## Example lookup rule
若某个模板存在同名示例文件，则在生成该文档前，优先同时参考：
- `templates/<name>.template.md`
- `examples/<name>.example.md`

映射规则：
- `templates/project_status.template.md` -> `examples/project_status.example.md`
- `templates/decisions.template.md` -> `examples/decisions.example.md`
- `templates/iteration_log.template.md` -> `examples/iteration_log.example.md`
- `templates/requirement_brief.template.md` -> `examples/requirement_brief.example.md`
- `templates/prd.template.md` -> `examples/prd.example.md`
- `templates/open_questions.template.md` -> `examples/open_questions.example.md`
- `templates/frontend_task.template.md` -> `examples/frontend_task.example.md`
- `templates/backend_task.template.md` -> `examples/backend_task.example.md`
- `templates/nodejs_task.template.md` -> `examples/nodejs_task.example.md`
- `templates/frontend_receipt.template.md` -> `examples/frontend_receipt.example.md`
- `templates/backend_receipt.template.md` -> `examples/backend_receipt.example.md`
- `templates/nodejs_receipt.template.md` -> `examples/nodejs_receipt.example.md`
- `templates/review_summary.template.md` -> `examples/review_summary.example.md`
- `templates/unresolved_issues.template.md` -> `examples/unresolved_issues.example.md`
- `templates/lessons_learned.template.md` -> `examples/lessons_learned.example.md`
- `templates/current_demo.template.md` -> `examples/current_demo.example.md`

## Template and example priority
若模板、示例、当前项目状态之间出现冲突，优先级如下：

1. `AGENTS.md`
2. `TOOLS.md`
3. 当前项目 canonical docs
4. `templates/*.template.md`
5. `examples/*.example.md`

示例只用于帮助理解合格输出应长什么样，不得覆盖当前项目真实状态。

## Example usage rule
- 示例只参考结构、表达方式和信息组织方式
- 不得把示例中的项目内容、字段、假设、结论原样搬到当前项目
- 如果当前项目已有更明确的信息，以当前项目文档为准
- 若无示例文件，则只按模板生成，不等待示例
- 模板骨架优先级高于示例表达；不得因为示例或模型习惯改写模板的 frontmatter、标题名、字段名或顺序

## Usage rules
- 新项目初始化时，先创建：
  - `00_meta/project_status.md`
  - `01_product/requirement_brief.md`
- 完成需求澄清后，创建或更新：
  - `01_product/prd.md`
  - `01_product/open_questions.md`
- 满足 handoff 门槛后，创建或更新：
  - `02_handoff/frontend_task.md`
  - 后端按执行代理二选一：`02_handoff/backend_task.md` 或 `02_handoff/nodejs_task.md`
- 收到前后端回执后，读取并汇总：
  - `03_receipts/frontend_receipt.md`
  - 后端按执行代理二选一：`03_receipts/backend_receipt.md` 或 `03_receipts/nodejs_receipt.md`
  - `00_meta/project_status.md`
  - `00_meta/decisions.md`
  - `00_meta/iteration_log.md`
- 收到 review 结果后，读取并汇总：
  - `04_review/review_summary.md`
  - `04_review/unresolved_issues.md`
  - `00_meta/project_status.md`
  - `00_meta/decisions.md`
  - `00_meta/iteration_log.md`
- 出现重复错误或流程性错误时，更新：
  - `04_review/lessons_learned.md`
- 满足 demo 门槛后，更新：
  - `05_delivery/current_demo.md`

## File roles
- `project_status.template.md`：项目主状态板
- `decisions.template.md`：关键决策记录
- `iteration_log.template.md`：每轮推进日志
- `requirement_brief.template.md`：需求原意与当前轮目标
- `prd.template.md`：结构化需求
- `open_questions.template.md`：待确认问题与默认假设
- `frontend_task.template.md`：前端 handoff
- `backend_task.template.md`：后端 handoff
- `nodejs_task.template.md`：Node.js 风格后端 handoff（当前仍由 demo-worker 执行）
- `frontend_receipt.template.md`：前端回执
- `backend_receipt.template.md`：后端回执
- `nodejs_receipt.template.md`：Node.js 风格后端回执（当前仍由 demo-worker 写回）
- `review_summary.template.md`：review 结论
- `unresolved_issues.template.md`：未解决问题
- `lessons_learned.template.md`：项目内 lessons
- `current_demo.template.md`：需求方当前可查看结果与交付清单

## Template constraints
- 模板只定义结构，不负责业务判断
- 模板应优先短、稳、固定字段清楚
- 状态型文件模板适合整文件覆盖
- 历史型文件模板适合追加写入
- 模板更新时，应优先保证字段稳定，不轻易改名
- 生成文档时必须保留模板 frontmatter 与固定 section 骨架，只填充值，不改骨架
