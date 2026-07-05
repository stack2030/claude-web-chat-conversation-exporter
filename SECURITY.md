# Security Policy

## Security model

Claude Web Chat Conversation Exporter is designed as a local-first browser-console utility.

The current version is intentionally simple:

- no backend
- no analytics
- no telemetry
- no tracking
- no remote JavaScript loading
- no external CDN dependency
- no third-party upload of conversation data

The script runs locally in the browser tab where the user has already opened Claude.ai.

## What the script does

The script:

1. Runs in the browser console.
2. Interacts with the currently open Claude.ai web conversation.
3. Uses visible Claude.ai copy controls.
4. Temporarily intercepts clipboard writes during export.
5. Stores captured content in browser memory during the run.
6. Downloads a local Markdown file.
7. Restores clipboard behavior after completion.

## What the script must not do

The project must not add:

- analytics
- tracking
- hidden remote calls
- third-party data upload
- credential collection
- cookie export
- session-token export
- API-key export
- background persistence
- silent execution
- hidden behavior
- provider access bypasses
- obfuscated code

If a proposed feature requires any of the above, it should be rejected or redesigned.

## User responsibility

Only use this tool for Claude.ai conversations you are authorized to access and export.

If your conversation contains confidential, regulated, employer, client, customer, legal, medical, financial, defense, or third-party information, follow the applicable rules before exporting or sharing the file.

This project is not a compliance system. It is a local export utility.

## Reporting security issues

If you find a security issue, open a GitHub issue with enough detail to reproduce the problem.

Do **not** include private conversation content, secrets, tokens, cookies, API keys, or credentials in the issue.

If you need to include screenshots, redact private content first.

## Claude UI breakage

If Claude.ai changes its web interface and the exporter breaks, open an issue using the Claude UI breakage template.

Include:

- browser
- operating system
- date tested
- console output
- whether export was complete, partial, or failed
- screenshots with private content removed

## Supported version

Current supported public baseline:

```text
Version: 0.1.0
Status: Working as of 2026-07
Target: Claude.ai web chat
Output: Markdown
```

## Trust guidance

Before running any browser-console script, review the source.

This repository intentionally keeps the script readable and auditable. If you are not comfortable reviewing JavaScript, ask a trusted technical person or an AI assistant to inspect it before running.

Do not run modified copies from unknown websites.

## No bug bounties

This project does not currently run a paid security bounty program.
