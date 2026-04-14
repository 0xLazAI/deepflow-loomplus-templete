---
name: agent-messenger
description: Route and send agent-to-agent notifications, owner notifications, and binding-targeted messages
---

Use this skill whenever the task is agent messaging rather than docs state persistence.

This skill can be invoked by `docs-manager` post-write hooks defined in `assets/root/hooks/docs-manager-hooks.json`.

Trigger rule: if user/system intent is to notify another agent, enqueue agent messages, send owner-visible status updates, or send a direct message to a bound Telegram chat, prefer this skill over `docs-manager`.

Always use this command pattern:

```bash
node {baseDir}/agent-messenger-executor.mjs --action <action> [named-options]
```

Supported actions:

- `--action enqueue_agent --agent-id <agentId> --session-id <sessionId> --message <text> [--binding-id <bindingId>|--project-id <projectId>|--path <relativePath>]`: enqueue one agent-directed message for asynchronous delivery.
- `--action drain`: process the queued notifications and send them to target agents.
- `--action send_agent --agent-id <agentId> --message <text> --session-id <sessionId>`: send one direct message to another OpenClaw agent.
- `--action send_binding_message --binding-id <bindingId> --account-id <accountId> --message <text>`: send one direct Telegram message to the chat derived from a Telegram binding id.

Routing note:

- Document-to-agent routing should live in `assets/root/hooks/docs-manager-hooks.json`.
- `agent-messenger` itself no longer interprets doc paths to decide targets.

Queue behavior:

- Queue retries are asynchronous and decoupled from docs writes.
- Retry env vars:
  - `AGENT_MESSENGER_MAX_RETRIES`
  - `AGENT_MESSENGER_BASE_BACKOFF_MS`
  - `AGENT_MESSENGER_MAX_BACKOFF_MS`
- Optional test/debug env:
  - `AGENT_MESSENGER_DISABLE_DRAIN=1` disables the detached drain worker trigger.

Important:

- `agent-messenger` is a skill name, not a shell executable.
- Never run `agent-messenger ...` directly in shell.
- Use named args only.
- `send_binding_message` only accepts Telegram-form binding ids (`tg:<chatId>`).
- Docs CRUD, binding, and canonical reads/writes still belong to `docs-manager`.
