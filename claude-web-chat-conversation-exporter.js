//
// Claude Web Chat Conversation Exporter
// Version: 0.1.6
//
// Copyright (c) 2026 Claude Web Chat Conversation Exporter contributors
// SPDX-License-Identifier: MIT
//
// Disclaimer:
// This project is an independent open-source tool and is not affiliated with,
// endorsed by, sponsored by, or officially associated with Anthropic.
// Claude and Anthropic are trademarks or registered trademarks of Anthropic PBC.
//
// Purpose:
// Export the currently open Claude.ai web conversation to a local Markdown file.
//
// Security notes:
// - Runs locally in your browser console.
// - Does not send conversation data to any third-party server.
// - Does not use analytics, tracking, CDN scripts, external APIs, or remote code.
// - Uses Claude.ai's own authenticated conversation data endpoint.
// - Does not intentionally collect or export credentials, cookies, API keys, or tokens.
// - Review the source before running. Do not run modified versions from untrusted sources.
//
// Usage:
// 1. Open the Claude.ai conversation.
// 2. Open browser developer tools.
// 3. Paste this full script into the console.
// 4. Press Enter.
// 5. Wait for the local Markdown file download.
//
// v0.1.6 cleanup:
// - Keeps the fast API-based export from v0.1.5.
// - Removes obsolete scrolling, clipboard interception, copy-button logic, retry logic,
//   virtualized-DOM scanning, and mounted-message detection.
// - Keeps output browser/screen/zoom/DevTools-position independent.
// - Adds cleaner structure and clearer diagnostics.
//

async function setupClaudeExporter() {
  const VERSION = '0.1.6';

  const CONFIG = {
    statusRemoveDelayMs: 15000,
    defaultFilename: 'claude_conversation',
    markdownTitle: 'Conversation with Claude'
  };

  const SELECTORS = {
    conversationTitle:
      '[data-testid="chat-title-button"] .truncate, button[data-testid="chat-title-button"] div.truncate'
  };

  const SKIPPED_BLOCK_TYPES = new Set([
    'thinking',
    'tool_use',
    'tool_result',
    'server_tool_use',
    'web_search_tool_result',
    'attachment',
    'file',
    'image',
    'document'
  ]);

  function logInfo(...args) {
    console.log(`[Claude Web Chat Conversation Exporter ${VERSION}]`, ...args);
  }

  function logWarn(...args) {
    console.warn(`[Claude Web Chat Conversation Exporter ${VERSION}]`, ...args);
  }

  function logError(...args) {
    console.error(`[Claude Web Chat Conversation Exporter ${VERSION}]`, ...args);
  }

  function createStatusBox() {
    const statusDiv = document.createElement('div');

    statusDiv.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 100000;
      background: #2196F3;
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      line-height: 1.45;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      max-width: 560px;
      white-space: pre-line;
    `;

    document.body.appendChild(statusDiv);
    return statusDiv;
  }

  const statusDiv = createStatusBox();

  function setStatus(message, color = '#2196F3') {
    statusDiv.style.background = color;
    statusDiv.textContent =
      `Claude Web Chat Conversation Exporter ${VERSION}\n${message}`;
  }

  function removeStatusLater() {
    setTimeout(() => {
      if (document.body.contains(statusDiv)) {
        document.body.removeChild(statusDiv);
      }
    }, CONFIG.statusRemoveDelayMs);
  }

  function formatTimestamp(isoString) {
    if (!isoString) return null;

    try {
      return new Date(isoString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return null;
    }
  }

  function sanitizeFilename(value) {
    return String(value || CONFIG.defaultFilename)
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
      .substring(0, 100) || CONFIG.defaultFilename;
  }

  function getConversationIdFromUrl() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || null;
  }

  function getOrgIdFromCookie() {
    return document.cookie.match(/lastActiveOrg=([^;]+)/)?.[1] || null;
  }

  function buildConversationApiUrl() {
    const conversationId = getConversationIdFromUrl();
    const orgId = getOrgIdFromCookie();

    if (!conversationId) {
      throw new Error('Could not detect Claude conversation ID from the current URL.');
    }

    if (!orgId) {
      throw new Error('Could not detect Claude organization ID from browser cookies.');
    }

    return `/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=true&rendering_mode=messages&render_all_tools=true`;
  }

  async function fetchConversationData() {
    const url = buildConversationApiUrl();

    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Claude conversation fetch failed: HTTP ${response.status}`);
    }

    return await response.json();
  }

  function getConversationTitle(data) {
    if (data?.name) {
      const title = String(data.name).trim();

      if (title && title !== 'New conversation') {
        return sanitizeFilename(title);
      }
    }

    const titleElement = document.querySelector(SELECTORS.conversationTitle);
    const domTitle = titleElement?.textContent?.trim();

    if (!domTitle || domTitle === 'Claude' || domTitle.includes('New conversation')) {
      return CONFIG.defaultFilename;
    }

    return sanitizeFilename(domTitle);
  }

  function normalizeSender(sender) {
    const value = String(sender || '').toLowerCase();

    if (value === 'human' || value === 'user') return 'human';
    if (value === 'assistant' || value === 'claude') return 'claude';

    return null;
  }

  function getCreatedAt(message) {
    return (
      message?.created_at ||
      message?.createdAt ||
      message?.updated_at ||
      message?.updatedAt ||
      message?.timestamp ||
      null
    );
  }

  function getSortKey(message, fallbackIndex) {
    const createdAt = getCreatedAt(message);

    if (createdAt) {
      const timestamp = Date.parse(createdAt);

      if (Number.isFinite(timestamp)) {
        return timestamp;
      }
    }

    return fallbackIndex;
  }

  function shouldSkipContentBlock(block) {
    const type = String(block?.type || '').toLowerCase();
    return SKIPPED_BLOCK_TYPES.has(type);
  }

  function extractTextFromContent(content) {
    if (!content) return '';

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map(item => extractTextFromContent(item))
        .filter(Boolean)
        .join('\n\n');
    }

    if (typeof content !== 'object') {
      return '';
    }

    if (shouldSkipContentBlock(content)) {
      return '';
    }

    if (typeof content.text === 'string') {
      return content.text;
    }

    if (typeof content.markdown === 'string') {
      return content.markdown;
    }

    if (typeof content.content === 'string') {
      return content.content;
    }

    if (Array.isArray(content.content)) {
      return extractTextFromContent(content.content);
    }

    if (Array.isArray(content.children)) {
      return extractTextFromContent(content.children);
    }

    return '';
  }

  function extractMessageText(message) {
    const fromContent = extractTextFromContent(message?.content).trim();

    if (fromContent) {
      return fromContent;
    }

    if (typeof message?.text === 'string') {
      return message.text.trim();
    }

    return '';
  }

  function parseExportableMessages(data) {
    if (!Array.isArray(data?.chat_messages)) {
      throw new Error('Claude conversation data did not contain chat_messages.');
    }

    return data.chat_messages
      .map((message, index) => {
        const type = normalizeSender(message.sender);
        const content = extractMessageText(message);

        return {
          index,
          type,
          content,
          createdAt: getCreatedAt(message),
          sortKey: getSortKey(message, index)
        };
      })
      .filter(message => message.type && message.content)
      .sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
        return a.index - b.index;
      });
  }

  function countMessages(messages) {
    let human = 0;
    let claude = 0;

    for (const message of messages) {
      if (message.type === 'human') human++;
      if (message.type === 'claude') claude++;
    }

    return {
      human,
      claude,
      total: human + claude
    };
  }

  function buildMarkdown(messages) {
    let markdown = `# ${CONFIG.markdownTitle}\n\n`;

    for (const message of messages) {
      if (message.type === 'human') {
        const timestamp = formatTimestamp(message.createdAt);
        const header = timestamp ? `## Human (${timestamp}):` : '## Human:';

        markdown += `${header}\n\n${message.content}\n\n---\n\n`;
        continue;
      }

      if (message.type === 'claude') {
        markdown += `## Claude:\n\n${message.content}\n\n---\n\n`;
      }
    }

    return markdown;
  }

  function downloadTextFile(content, filename, mimeType = 'text/markdown;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  function buildReport(data, messages) {
    const counts = countMessages(messages);

    return {
      version: VERSION,
      source: 'Claude conversation data endpoint',
      conversationName: data?.name || null,
      rawChatMessages: Array.isArray(data?.chat_messages) ? data.chat_messages.length : null,
      exportedHumanMessages: counts.human,
      exportedClaudeMessages: counts.claude,
      exportedTotalMessages: counts.total
    };
  }

  try {
    setStatus('Fetching Claude conversation data...');

    const data = await fetchConversationData();

    setStatus('Parsing exportable messages...');

    const messages = parseExportableMessages(data);
    const counts = countMessages(messages);

    if (counts.total === 0) {
      throw new Error('No exportable human or Claude messages found in conversation data.');
    }

    const markdown = buildMarkdown(messages);
    const filename = `${getConversationTitle(data)}.md`;

    downloadTextFile(markdown, filename);

    const report = buildReport(data, messages);

    setStatus(
      `SUCCESS\n` +
      `Human: ${counts.human} | Claude: ${counts.claude} | Total: ${counts.total}\n` +
      `Downloaded: ${filename}`,
      '#4CAF50'
    );

    logInfo('Export successful.');
    logInfo(`Human: ${counts.human}, Claude: ${counts.claude}, Total: ${counts.total}`);
    logInfo('Export report:', report);
  } catch (error) {
    setStatus(`ERROR: ${error.message}`, '#f44336');
    logError('Export failed:', error);
  } finally {
    removeStatusLater();
  }
}

setupClaudeExporter();