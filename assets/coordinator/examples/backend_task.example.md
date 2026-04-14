---
task_id: be_event-signup_001
project_code: event-signup
owner: backend
status: new
last_updated_at: 2026-03-25T10:10:00+08:00
---

# Backend Task

## 目标
完成活动报名系统第一轮后端 MVP，支持报名数据提交、存储和后台列表查询。

## 范围
- 报名提交能力
- 报名数据存储
- 报名列表查询能力

## 输入依据
- 00_meta/project_status.md
- 01_product/requirement_brief.md
- 01_product/prd.md
- 01_product/open_questions.md

## 联动输入
无

## 当前默认假设
- 第一轮不接登录或权限系统
- 后台列表默认返回全部报名数据
- 钱包地址字段本轮不作为必填结构进入存储模型

## 输出要求
- 给出标准 backend_receipt
- 说明当前可推进内容
- 说明当前问题
- 说明当前阻塞
- 说明当前产出

## 当前备注
- 优先保证主链路可用，不优先做复杂校验和扩展能力
- 后续若加入权限和导出，再单独扩展接口和数据结构
