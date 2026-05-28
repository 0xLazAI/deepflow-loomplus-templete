# Tools

All Loom+ calls go through:

```bash
loom run <tool> --json '<payload>'
```

Prefer the runtime tool reference at:
- `/tmp/deepflow-assets/loom-tools.md`
- `/home/ubuntu/loomcli/docs`

## Projects

List projects:

```bash
loom run list_projects
```

Resolve a project id by project name:

```bash
loom run get_project_id_by_name --json '{"name":"Website Revamp"}'
```

Create a project after user confirmation:

```bash
loom run create_project --json '{"name":"Website Revamp","description":"Refresh the marketing website"}'
```

Update a project:

```bash
loom run update_project --json '{"projectId":"project_id","name":"New name","description":"New description"}'
```

Update project status:

```bash
loom run update_project_status --json '{"projectId":"project_id","status":"IN_PROGRESS"}'
```

Delete a project only after explicit confirmation:

```bash
loom run delete_project --json '{"projectId":"project_id"}'
```

List project members:

```bash
loom run list_project_members --json '{"projectId":"project_id"}'
```

## Tasks / missions

List tasks in a project:

```bash
loom run list_missions --json '{"projectId":"project_id"}'
```

Get task detail:

```bash
loom run get_mission --json '{"missionId":"mission_id"}'
```

Create a task by project name:

```bash
loom run create_mission_by_project_name --json '{"projectName":"Website Revamp","title":"Draft landing copy","description":"Prepare first version","assigneeEmail":"owner@example.com","deadline":"2026-06-01","priority":"P1"}'
```

List tasks by deadline:

```bash
loom run list_missions_by_deadline --json '{"projectIds":["project_id"],"deadline":"2026-06-01"}'
```

Optionally filter by assignee emails:

```bash
loom run list_missions_by_deadline --json '{"projectIds":["project_id"],"deadline":"2026-06-01","emails":["owner@example.com"]}'
```

Update a task:

```bash
loom run update_mission --json '{"missionId":"mission_id","status":"IN_PROGRESS","assigneeEmail":"owner@example.com","deadline":"2026-06-03","reason":"User requested reassignment"}'
```

Delete a task only after explicit confirmation:

```bash
loom run delete_mission --json '{"missionId":"mission_id"}'
```

Get task logs:

```bash
loom run get_mission_logs --json '{"missionId":"mission_id"}'
```

## Progress and risk workflow

For a progress summary:
1. Use `get_project_id_by_name` if the user supplied a name.
2. Use `list_missions` for the project.
3. Group tasks by `DONE`, `IN_PROGRESS`, and unfinished statuses.
4. Inspect deadlines from the returned tasks.
5. If the user asks for a specific deadline day, use `list_missions_by_deadline`.
6. Reply with completed, in-progress, unfinished, and risks.

Risk rules:
- Overdue unfinished tasks are high risk.
- Tasks due within the next few days are medium risk if not `DONE`.
- Unassigned high-priority tasks are a delivery risk.
- Missing deadlines should be called out only when deadline tracking matters to the user's request.
