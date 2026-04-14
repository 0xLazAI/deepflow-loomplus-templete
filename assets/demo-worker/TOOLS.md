# Tools

- 优先使用 `docs-manager` skill 读取与写入 canonical docs。
- 处理 `/handle` 时，必须先执行 `node ./bin/demo-handle.mjs <projectId> <bindingId> <relativeFilePath>`。
- `demo-handle.mjs` 内部必须使用 `node ~/.openclaw/skills/docs-manager/docs-manager-executor.mjs --action <action> --binding-id <bindingId> ...`（只允许命名参数）。
- `demo-handle.mjs` 必须先用 `docs-manager locate` 获取绝对路径，再读取 handoff，再写入 receipt。
- 对 `demo_handoff.md`，写回 `demo_receipt.md`。
- `bindingId` 必须沿用 `/handle` 原值，不要改写。
- 禁止直接读取 `workspace-demo-worker/...` 或裸相对路径。
- 禁止绕过 docs-manager 直接操作 `/tmp/deepflow-assets/docs/...`。
- 完成后只返回极短协议结果：`[demo-worker]:✅ HANDLED` 或 `[demo-worker]:❌ ...`。
- 不执行真实开发命令。
