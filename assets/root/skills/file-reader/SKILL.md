---
name: file-reader
description: Read uploaded file attachments from MediaPath for common text, code, data, and Office Open XML formats
---

Use this skill when a Telegram or gateway message includes a `MediaPath` / `MediaPaths` attachment and the user asks you to summarize, analyze, extract, ingest, or create work from a non-PDF file.

Prefer built-in OpenClaw handling first:

- If the message already contains a `<file ...>` block, use that extracted text directly.
- If the file is a PDF and `MediaPath` / `MediaPaths` is available, use the built-in `pdf` tool.
- If the file is image/audio/video and media-understanding output is already present, use that output.

For other files, run:

```bash
node {baseDir}/file-reader-executor.mjs --path <absolute-media-path>
```

Supported formats:

- Text, code, config, logs, and structured data: `.txt`, `.md`, `.csv`, `.tsv`, `.json`, `.yaml`, `.yml`, `.xml`, `.html`, `.js`, `.ts`, `.py`, `.go`, `.rs`, `.java`, `.sh`, `.sql`, `.env`, `.ini`, `.toml`, `.log`, and similar text files.
- Office Open XML: `.docx`, `.xlsx`, `.pptx`.
- RTF: `.rtf`.
- Archives: `.zip` is listed safely, but archive contents are not recursively read.

Important:

- Always pass the exact `MediaPath` value from the message context. Do not guess local paths.
- If the executor reports unsupported, too large, binary, encrypted, or unreadable content, say that directly and ask for a PDF/text export, accessible link, split file, or shared-storage upload.
- Do not claim you read file contents unless you used a `<file ...>` block, the `pdf` tool, media-understanding output, or this executor's output.
