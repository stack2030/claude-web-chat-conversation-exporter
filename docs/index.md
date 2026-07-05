# Claude Web Chat Conversation Exporter Documentation

Welcome to the documentation page for **Claude Web Chat Conversation Exporter**.

This project helps users export Claude.ai web conversations locally to Markdown.

Project repo:

```text
https://github.com/stack2030/claude-web-chat-conversation-exporter
```

If the tool helps you, star the repo, watch it for breakage updates, and share it with people who need private Claude conversation exports.

---

## Quick summary

Claude Web Chat Conversation Exporter is a local browser-console script for saving Claude.ai web chat conversations as Markdown files.

It is useful for:

- backups
- knowledge bases
- research archives
- coding sessions
- planning documents
- multi-AI workflows
- reusable context
- documentation trails

It is built around a simple privacy promise:

```text
Your Claude conversation should not need to visit another server just to become a file on your computer.
```

---

## Current public version

```text
Version: 0.1.0
Status: Working as of 2026-07
Output: Markdown
Target: Claude.ai web chat
Mode: Browser console script
```

---

## How to use

1. Open the Claude.ai web conversation.
2. Open browser developer tools.
3. Open the Console tab.
4. Paste the full JavaScript from `claude-web-chat-conversation-exporter.js`.
5. Press Enter.
6. Wait for the export to complete.
7. Review the downloaded Markdown file.

---

## Privacy notes

The tool runs locally in your browser.

It does not include:

- analytics
- tracking
- third-party upload
- external scripts
- remote execution service

The current script is deliberately readable so users can inspect what it does.

---

## Why Markdown

Markdown is portable.

It works with:

- GitHub
- Obsidian
- Logseq
- static sites
- documentation systems
- local search
- AI context windows
- code repositories
- editors

Plain text export is planned, but Markdown is the first format because it preserves structure better.

---

## Typical workflows

### Save important Claude work

Export a conversation after a useful research, coding, writing, or planning session.

### Move context between AI tools

Use Claude’s conversation as context for another AI tool.

### Keep versioned snapshots manually

Until timestamped filenames are added, rename exported files manually if you export the same conversation multiple times.

Example:

```text
my-claude-project-2026-07-05-1430.md
my-claude-project-2026-07-05-1810.md
```

### Archive into a knowledge base

Save the Markdown into your local knowledge base or project folder.

---

## If something breaks

Open an issue on GitHub.

Please include:

- browser
- operating system
- date tested
- console output
- expected result
- actual result
- whether the exported Markdown was complete

Do not paste private conversation content unless you intentionally choose to share it.

---

## Planned improvements

- timestamped filenames
- plain text export
- optional visible thinking/timeline export
- optional generated file/artifact export
- Chrome extension
- better troubleshooting docs
- screenshots/GIF usage guide

---

## Community request

If you use this project:

- star it so others find it
- watch it if you rely on it
- open issues when Claude changes something
- share it with people who need private AI chat exports

The best bug report is the one opened before everyone quietly rage-clicks into the void.
