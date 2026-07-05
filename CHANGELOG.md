# Changelog

All notable public changes to this project will be documented here.

This project follows simple semantic versioning while it is early-stage:

```text
MAJOR.MINOR.PATCH
```

## v0.1.3 - 2026-07-05

### Fixed

- Skips Claude status/timeline/thinking-only rows in the baseline Markdown export.
- Prevents false partial-export warnings when Claude inserts non-conversation status entries.
- Keeps baseline export focused on Human messages and final Claude response messages.

### Current scope

- Claude.ai web chat conversation export.
- Local browser-console execution.
- Markdown output.
- No backend, no analytics, no third-party upload.
- Status/timeline/thinking export is not included yet and will be handled as a future optional feature.

## v0.1.0 - 2026-07-05

### Added

- Initial public version.
- Claude.ai web chat conversation export to Markdown.
- Browser-console execution.
- Local-only export flow.
- Progress overlay with Human / Claude / Total counts.
- Long conversation scrolling support.
- Silent skip-and-revisit capture strategy.
- Success / partial-export reporting.
- Independent project disclaimer.
- MIT license.

### Current status

```text
Status: Working as of 2026-07
Target: Claude.ai web chat
Output: Markdown
Mode: Browser console script
```

### Not included yet

- Plain text export.
- Timestamped filenames.
- Visible thinking/timeline export.
- Generated file/artifact export.
- Chrome extension.

### Notes

Claude.ai is a changing web application. If the UI changes and export breaks, open an issue using the issue template.
