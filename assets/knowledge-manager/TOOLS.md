# Tools

All Loom+ calls go through:

```bash
loom run <tool> --json '<payload>'
```

Prefer the runtime tool reference at:
- `/tmp/deepflow-assets/loom-tools.md`
- `/home/ubuntu/loomcli/docs`

## Knowledge bases

List active knowledge bases:

```bash
loom run list_knowledge_bases
```

Resolve a knowledge base id by name:

```bash
loom run get_knowledge_base_id --json '{"name":"Product Wiki"}'
```

Create a knowledge base after user confirmation:

```bash
loom run create_knowledge_base --json '{"name":"Product Wiki"}'
```

Rename a knowledge base:

```bash
loom run update_knowledge_base_name --json '{"kbId":"kb_id","name":"New Wiki Name"}'
```

## Documents

Insert a new document:

```bash
loom run upsert_document --json '{"kbId":"kb_id","content":"# Title\n\nDocument body","source":"telegram thread"}'
```

Update an existing document:

```bash
loom run upsert_document --json '{"kbId":"kb_id","documentId":"document_id","content":"# Updated title\n\nUpdated body","source":"edited wiki note"}'
```

List documents in a knowledge base:

```bash
loom run list_documents --json '{"kbId":"kb_id","page":1,"pageSize":20}'
```

Search documents in a knowledge base:

```bash
loom run list_documents --json '{"kbId":"kb_id","query":"onboarding"}'
```

Delete a document only after explicit confirmation:

```bash
loom run delete_document --json '{"kbId":"kb_id","documentId":"document_id"}'
```

## Wiki Q&A

Ask one knowledge base:

```bash
loom run ask_knowledge_base --json '{"kbId":"kb_id","question":"What is our onboarding process?"}'
```

Ask all active knowledge bases:

```bash
loom run ask_all_knowledge_bases --json '{"question":"What do we know about onboarding?"}'
```

Optional model override:

```bash
loom run ask_knowledge_base --json '{"kbId":"kb_id","question":"Summarize this wiki","modelId":"model_id"}'
```

## Common workflows

When a user says "remember this":
1. Determine target KB.
2. If no KB exists, ask whether to create one.
3. Format the content into a useful note.
4. Call `upsert_document`.
5. Reply with the KB name and document id.

When a user asks a question:
1. Use `ask_knowledge_base` if a KB is named.
2. Use `ask_all_knowledge_bases` if the request is broad.
3. Summarize answer and sources.

When a user wants cleanup:
1. Use `list_documents`.
2. Let the user pick document ids.
3. Confirm destructive deletes.
4. Call `delete_document`.
