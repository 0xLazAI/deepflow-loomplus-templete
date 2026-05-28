# Tools

所有 Loom+ 工具调用都走 `loom run <tool> --json '<payload>'`。

优先参考：
- `/tmp/deepflow-assets/loom-tools.md`
- `/home/ubuntu/loomcli/docs/modules/03-identity-and-binding.md`
- `/home/ubuntu/loomcli/docs/modules/04-meetings-and-links.md`

## Identity lookup

当用户通过 Telegram / Discord / Slack 等平台身份指定参会人时，先查邮箱。

单人查询：

```bash
loom run get_user_email_by_platform_id --json '{"platform":"telegram","platformId":"123456"}'
```

多人查询：

```bash
loom run get_user_emails_by_ids --json '{"platform":"telegram","ids":["123456","789012"]}'
```

规则：
- `platformId` 必须是平台数字 id 或平台真实 id，不是 `@username`
- Telegram 数字 id 优先来自当前消息元数据、reply 对象或 mention user id
- 查不到邮箱时，不要猜测；向用户说明哪些参会人缺邮箱绑定

## Create meeting

```bash
loom run create_google_meeting --json '{"summary":"Weekly Sync","startTime":"2026-04-14T10:00:00+08:00","endTime":"2026-04-14T11:00:00+08:00","attendeeEmails":["a@example.com","b@example.com"],"timeZone":"Asia/Shanghai"}'
```

必需字段：
- `summary`
- `startTime`
- `endTime`
- `attendeeEmails`

可选字段：
- `timeZone`

## Update meeting

```bash
loom run update_google_meeting_by_link --json '{"meetingLink":"https://meet.google.com/xxx-xxxx-xxx","summary":"Updated Sync"}'
```

规则：
- 必须有 `meetingLink`
- 只传用户明确要更新的字段
- 更新参会人时传完整的 `attendeeEmails`

## Delete meeting

```bash
loom run delete_google_meeting_by_link --json '{"meetingLink":"https://meet.google.com/xxx-xxxx-xxx"}'
```

规则：
- 必须有 `meetingLink`
- 如果用户没有明确给出会议链接，先追问或用 `list_upcoming_meetings` 帮助定位

## Scheduling session

时间未定、需要大家选时间时使用：

```bash
loom run scheduling_create_session --json '{"topic":"Team Meeting","organizer":{"tgId":"123456","name":"Min"},"attendees":[{"tgId":"789012","name":"Alex"}],"chatId":"-1001234567890","days":3,"duration":60}'
```

规则：
- `organizer.tgId` 和 `attendees[].tgId` 使用 Telegram 数字 id
- 在 Telegram 群内发起时，尽量带上当前 `chatId`
- 默认 `days=3`、`duration=60`，除非用户明确指定

## Upcoming meetings

```bash
loom run list_upcoming_meetings
loom run list_upcoming_meetings --json '{"withinHours":48}'
loom run list_upcoming_meetings --json '{"platform":"telegram","platformId":"123456","withinHours":48}'
```

规则：
- 用户问“接下来有什么会”时使用
- 用户问某个人的会议时，先拿到该人的 platform id，再用平台过滤
