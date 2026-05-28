# Deepflow Base

`deepflow-base` 是一个精简的 OpenClaw agent 基座仓库。

当前默认只保留两类 agent：

- `coordinator`：主协调 agent
- `demo-worker`：演示用 worker，收到任务后按约定返回完成结果

当前默认只保留两个基础 skill：

- `docs-manager`：管理项目文档状态、绑定关系、canonical docs 读写
- `agent-messenger`：负责消息入队、重试和发送

## loom+ v0

当前仓库已开始承载 `loom+ v0` 的团队协作工作流基线。

当前新增的核心方向：

- 以 `Coordination Issue` 作为最小运行单位
- 使用固定状态流推进协作：`received -> parsed -> planned -> routed -> pending_confirmation -> executing -> receipted -> summarized -> closed`
- 为每个协调实例生成最小工件：`intent-brief`、`coordination-card`、`routing-receipt`、`status-snapshot`、`execution-receipt`、`summary-digest`、`rule-update`
- 暴露 `loomcli` 兼容接口：`/api/cli/login`、`/api/cli/tools`、`/api/cli/run`

默认存储位置：

```text
<DOCS_ROOT>/loomplus/projects/<projectId>/
```

其中每个协调实例会写到：

```text
<DOCS_ROOT>/loomplus/projects/<projectId>/coordination/<issueId>/
```

可通过 `loomcli` 调用的首批工具包括：

- `list_projects`
- `get_project_id_by_name`
- `create_project`
- `update_project`
- `update_project_status`
- `list_coordination_issues`
- `get_coordination_issue`
- `create_coordination_issue`
- `update_coordination_issue`
- `get_coordination_issue_logs`
- `get_status_snapshot`
- `create_hot_response_issue`
- `create_meeting_followup_issue`

其中两条与 `loomplus.md` 对齐的 MVP 模板流已经可直接调用：

- 热点响应协作流：`create_hot_response_issue`
- 会议结果进入执行流：`create_meeting_followup_issue`

CLI 认证默认读取：

- `LOOMPLUS_CLI_ACCESS_TOKENS`
- 或 `LOOMPLUS_CLI_ACCESS_TOKEN`
- 若未设置，则回退到 `DOCS_AUTH_TOKEN`

## 当前结构

核心协作链路：

1. `coordinator` 负责维护状态和项目文档
2. `docs-manager` 负责文档写入
3. 文档写入后，`docs-manager` 读取 hook 配置
4. hook 命令可以调用 `agent-messenger`
5. `agent-messenger` 负责把消息发送给目标 agent

默认 demo hook 只保留两条：

- `demo_handoff.md`
- `demo_receipt.md`

对应配置文件：`assets/root/hooks/docs-manager-hooks.json`

## 仓库结构

```text
.
├── recipe.yaml
├── assets/
│   ├── coordinator/
│   ├── demo-worker/
│   └── root/
│       ├── hooks/
│       └── skills/
│           ├── docs-manager/
│           └── agent-messenger/
├── src/
├── test/
├── Dockerfile
└── package.json
```

## 快速开始

安装依赖：

```bash
npm install
```

构建：

```bash
npm run build
```

Docker 构建会额外安装 `loomcli`：

- `loomcli` 当前为 public repo，不再需要 `GITHUB_TOKEN`
- 构建阶段会拉取 `https://github.com/0xLazAI/loomcli.git` 并执行全局安装

## Deploy to DigitalOcean

仓库包含 `.do/deploy.template.yaml`，可通过 DigitalOcean App Platform 的一键部署入口创建服务：

```text
https://cloud.digitalocean.com/apps/new?repo=https://github.com/0xLazAI/deepflow-loomplus-templete/tree/main
```

DigitalOcean 会在创建 app 时提示填写环境变量。必填变量如下：

| 环境变量 | 作用 | 示例/来源 |
| --- | --- | --- |
| `COORDINATOR_TELEGRAM_BOT_KEY` | Coordinator agent 使用的 Telegram bot token。 | 从 BotFather 获取。 |
| `GOOGLE_MEETING_TELEGRAM_BOT_KEY` | Google Meeting agent 使用的 Telegram bot token。留空时不启用该 agent 的 Telegram 入口。 | 从 BotFather 获取。 |
| `LOOM_TOKEN` | Loom+ 团队 access token，供容器内 `loomcli login` 使用。 | 在 Loom+ 的 Agents/Access Token 页面生成。 |
| `OPENAI_API_KEY` | OpenClaw/agent 使用的 OpenAI API key。 | `sk-...` |
| `ALLOWED_ORIGIN` | OpenClaw control UI 允许的前端来源。通常填 Loom+ 服务地址；未设置 `LOOM_SERVER/NEXTAUTH_URL` 时也会作为 `loomcli login` 的 server URL。 | `https://your-loomplus-domain.example` |
| `DOCS_AUTH_TOKEN` | deepflow 内置 docs 页面和 CLI fallback token。未配置 `LOOMPLUS_CLI_ACCESS_TOKEN(S)` 时也会作为本服务本地 CLI token 的回退值。 | 自行生成一段随机密码。 |
| `WEB_PORT` | 容器内 Web 服务端口。DigitalOcean 模板默认 `3000`。 | `3000` |

可选变量：

| 环境变量 | 作用 |
| --- | --- |
| `LOOM_SERVER` | 覆盖 `loomcli login --server` 使用的 Loom+ URL。通常不需要单独填写。 |
| `NEXTAUTH_URL` | `LOOM_SERVER` 的兼容别名，方便从 Loom+/NextAuth 部署配置复制过来；它不会自动从 Loom+ 应用传入本部署。 |

基础测试：

```bash
npm run test:recipe
npm run test:docs-manager
npm run test:agent-messenger
```

开发模式：

```bash
npm run dev
```

仅启动本地服务：

```bash
npm run dev:server
```

## Skills

### `docs-manager`

职责：

- 绑定会话到项目
- 初始化 canonical docs
- 读写、追加、替换、列出、定位文档
- 在文档写入后执行 post-write hooks

默认 hook 配置：

- 路径：`assets/root/hooks/docs-manager-hooks.json`
- 可通过 `DOCS_MANAGER_HOOKS_FILE` 覆盖

当前 hook 机制是：

- 文档写入成功后，按路径匹配 hook
- 顺序执行该路径对应的命令
- hook 执行失败不会回滚文档写入

### `agent-messenger`

职责：

- 消息入队
- 异步重试
- 向目标 agent 发送消息
- 向 Telegram binding 发送直接消息

它本身不再解释“哪个文档发给哪个 agent”。
这层路由规则现在只放在 hook 命令里。

## Hook 示例

默认仓库只保留 demo 规则，思路如下：

- 当 `demo_handoff.md` 更新时，hook 把 `/handle ...` 发给 `demo-worker`
- 当 `demo_receipt.md` 更新时，hook 把通知发给 `coordinator`

也就是说：

- 文档路径到目标 agent 的映射在 `docs-manager-hooks.json`
- `agent-messenger` 只负责执行消息投递

## Agents

### `coordinator`

- 对外主入口
- 负责协调、状态维护和文档更新

### `demo-worker`

- 仅作为演示执行代理
- 不承担真实开发工作
- 用于验证 `coordinator -> docs -> hooks -> messenger -> worker` 这条链路

## 配置

核心配置文件：`recipe.yaml`

当前主要内容包括：

- workspaces：`coordinator`、`demo-worker`
- agents：`coordinator`、`demo-worker`
- channels：当前 Telegram 示例接入

如果只做本地代码层开发，通常先关注：

- `assets/coordinator`
- `assets/demo-worker`
- `assets/root/skills/docs-manager`
- `assets/root/skills/agent-messenger`
- `assets/root/hooks/docs-manager-hooks.json`

## 集成测试

仓库保留了 Telegram mock 集成测试入口：

```bash
npm run test:integration
```

这部分依赖额外环境与 mock server，适合在需要验证消息链路时再使用。

## Docker / 部署

仓库保留了 `Dockerfile` 与 `docker-compose.yml`，可以继续用于容器化运行。

最简方式：

```bash
docker compose up -d --build
```

当前镜像会安装并使用：

- `clawchef`
- `openclaw@2026.3.2`
- 项目自身 npm 依赖

当前已经移除：

- 私有 CLI 仓库拉取
- `@openai/codex`
- Docker build 时的 GitHub token 依赖

如果不需要 S3 同步能力，运行时也可以不提供 AWS 相关环境变量；服务会自动跳过这部分逻辑。

## 当前定位

这个仓库现在的定位是：

- 一个可运行的最小 agent 基座
- 一个 docs + hooks + messenger 的协作样板
- 一个方便继续扩展更多 agent 的起点

它不再是原来的多角色研发流水线仓库。

## 相关命令

```bash
npm run build
npm run test:recipe
npm run test:docs-manager
npm run test:agent-messenger
npm run test:integration
```

## License

待补充。
