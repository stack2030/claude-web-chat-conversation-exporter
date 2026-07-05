//
// Claude Web Chat Conversation Exporter
// Version: 0.1.3
//
// Copyright (c) 2026 Claude Web Chat Conversation Exporter contributors
// SPDX-License-Identifier: MIT
//
// Disclaimer:
// This project is an independent open-source tool and is not affiliated with,
// endorsed by, sponsored by, or officially associated with Anthropic.
// Claude and Anthropic are trademarks or registered trademarks of Anthropic PBC.
// All product names, logos, and brands are property of their respective owners.
//
// Purpose:
// Export the currently open Claude.ai web conversation to a local Markdown file.
//
// Security notes:
// - Runs locally in your browser console.
// - Does not send conversation data to any third-party server.
// - Does not use analytics, tracking, CDN scripts, external APIs, or remote code.
// - Interacts only with the currently open Claude.ai web session.
// - Uses Claude.ai's own visible copy buttons.
// - Temporarily intercepts clipboard writes during export.
// - Restores original clipboard behavior after export.
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
// Current scope:
// - Markdown export only.
// - Claude.ai web chat only.
// - Normal Human and Claude response messages only.
// - Claude status/timeline/thinking-only entries are skipped in this baseline version.
// - No TXT export yet.
// - No timestamped filenames yet.
// - No thinking/timeline export yet.
// - No generated-file/artifact export yet.
//
// v0.1.3 fix:
// - Counts Claude responses as exportable only when they contain actual Markdown response blocks.
// - Skips Claude status/timeline/thinking-only rows in the baseline Markdown export.
// - Fixes false PARTIAL EXPORT caused by non-exportable Claude status entries.
//

async function setupClaudeExporter() {
  const VERSION = '0.1.3';

  const originalWriteText = navigator.clipboard.writeText?.bind(navigator.clipboard);
  const originalWrite = navigator.clipboard.write?.bind(navigator.clipboard);

  const capturedByPosition = new Map();
  const skippedByPosition = new Map();
  const ignoredByPosition = new Map();
  const attemptCountByPosition = new Map();
  const knownExportablePositions = new Map();

  let conversationData = null;
  let interceptorActive = true;
  let currentTarget = null;
  let fatalError = null;

  const SELECTORS = {
    copyButton: 'button[data-testid="action-bar-copy"]',
    conversationTitle: '[data-testid="chat-title-button"] .truncate, button[data-testid="chat-title-button"] div.truncate',
    feed: '[role="feed"][aria-label="Chat messages"]',
    article: '[role="article"][aria-posinset]',
    userMessage: '[data-testid="user-message"], [data-user-message-bubble="true"]',
    assistantMarkdown: '.standard-markdown, .progressive-markdown',
    loadButtonText: /load (earlier|later) messages/i
  };

  const SETTINGS = {
    scrollDelayMs: 700,
    afterScrollIntoViewMs: 250,
    captureTimeoutMs: 3000,
    afterFailedCapturePauseMs: 350,
    betweenMessagesMs: 250,
    maxAttemptsPerMessage: 3,
    maxFullPasses: 8,
    stagnantPassLimit: 3,
    scrollStepRatio: 0.5,
    minimumScrollStepPx: 350,
    statusRemoveDelayMs: 15000
  };

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function logInfo(...args) {
    console.log(`[Claude Web Chat Conversation Exporter ${VERSION}]`, ...args);
  }

  function logWarn(...args) {
    console.warn(`[Claude Web Chat Conversation Exporter ${VERSION}]`, ...args);
  }

  function logError(...args) {
    console.error(`[Claude Web Chat Conversation Exporter ${VERSION}]`, ...args);
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
    return String(value || 'claude_conversation')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
      .substring(0, 100) || 'claude_conversation';
  }

  function downloadMarkdown(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const a = document.createElement('a');

    a.href = URL.createObjectURL(blob);
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(a.href);
  }

  async function fetchConversationData() {
    try {
      const conversationId = window.location.pathname.split('/').pop();
      const orgId = document.cookie.match(/lastActiveOrg=([^;]+)/)?.[1];

      if (!conversationId || !orgId) return null;

      const url = `/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=true&rendering_mode=messages&render_all_tools=true`;

      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) return null;

      return await response.json();
    } catch {
      return null;
    }
  }

  function getMessageTimestamps(data) {
    const map = new Map();

    if (!data?.chat_messages) return map;

    for (const msg of data.chat_messages) {
      if (msg.sender === 'human') {
        const text = msg.content?.map(c => c.text ?? '').join('').trim();
        if (text) {
          map.set(text, formatTimestamp(msg.created_at));
        }
      }
    }

    return map;
  }

  function getConversationTitle() {
    if (conversationData?.name) {
      const title = conversationData.name.trim();

      if (title && title !== 'New conversation') {
        return sanitizeFilename(title);
      }
    }

    const titleElement = document.querySelector(SELECTORS.conversationTitle);
    const title = titleElement?.textContent?.trim();

    if (!title || title === 'Claude' || title.includes('New conversation')) {
      return 'claude_conversation';
    }

    return sanitizeFilename(title);
  }

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

  function getCounts() {
    let human = 0;
    let claude = 0;

    for (const msg of capturedByPosition.values()) {
      if (msg.type === 'human') human++;
      if (msg.type === 'claude') claude++;
    }

    return {
      human,
      claude,
      total: human + claude
    };
  }

  function getMountedArticles() {
    return [...document.querySelectorAll(SELECTORS.article)]
      .map(article => ({
        article,
        position: Number(article.getAttribute('aria-posinset')),
        setsize: Number(article.getAttribute('aria-setsize')) || 0
      }))
      .filter(x => Number.isFinite(x.position) && x.position > 0)
      .sort((a, b) => a.position - b.position);
  }

  function hasMeaningfulText(element) {
    if (!element) return false;

    const text = element.textContent
      ?.replace(/\s+/g, ' ')
      .trim();

    return !!text && text.length > 0;
  }

  function hasAssistantExportableContent(article) {
    const markdownBlocks = [
      ...article.querySelectorAll(SELECTORS.assistantMarkdown)
    ];

    return markdownBlocks.some(block => hasMeaningfulText(block));
  }

  function getArticleKind(article) {
    if (article.querySelector(SELECTORS.userMessage)) {
      return 'human';
    }

    if (hasAssistantExportableContent(article)) {
      return 'claude';
    }

    return 'ignore';
  }

  function registerArticle(article, position) {
    const kind = getArticleKind(article);

    if (kind === 'ignore') {
      ignoredByPosition.set(position, 'Claude status/timeline/thinking-only entry. Skipped for normal Markdown export.');
      knownExportablePositions.delete(position);
      return kind;
    }

    knownExportablePositions.set(position, kind);
    ignoredByPosition.delete(position);
    return kind;
  }

  function getKnownMissingPositions() {
    return [...knownExportablePositions.keys()]
      .filter(position => !capturedByPosition.has(position))
      .sort((a, b) => a - b);
  }

  function getAttemptCount(position) {
    return attemptCountByPosition.get(position) || 0;
  }

  function incrementAttemptCount(position) {
    const next = getAttemptCount(position) + 1;
    attemptCountByPosition.set(position, next);
    return next;
  }

  function isAttemptExhausted(position) {
    return getAttemptCount(position) >= SETTINGS.maxAttemptsPerMessage;
  }

  function getRetryableMissingPositions() {
    return getKnownMissingPositions()
      .filter(position => !isAttemptExhausted(position));
  }

  function updateStatus(extra = '') {
    const counts = getCounts();
    const knownMissing = getKnownMissingPositions();
    const retryableMissing = getRetryableMissingPositions();

    statusDiv.textContent =
      `Claude Web Chat Conversation Exporter ${VERSION}\n` +
      `Human: ${counts.human} | Claude: ${counts.claude} | Total: ${counts.total}\n` +
      `Exportable seen: ${knownExportablePositions.size} | Missing: ${knownMissing.length} | Ignored: ${ignoredByPosition.size}` +
      ` | Retryable: ${retryableMissing.length}` +
      (extra ? `\n${extra}` : '');
  }

  function captureClipboardText(text) {
    if (!interceptorActive || !text || !currentTarget) return;

    const cleanText = String(text).trimEnd();

    if (!cleanText) return;

    capturedByPosition.set(currentTarget.position, {
      position: currentTarget.position,
      type: currentTarget.type,
      content: cleanText
    });

    skippedByPosition.delete(currentTarget.position);

    updateStatus(`Captured message ${currentTarget.position}`);
  }

  if (!navigator.clipboard) {
    throw new Error('navigator.clipboard is not available. Run this from the Claude.ai page console.');
  }

  if (navigator.clipboard.writeText) {
    navigator.clipboard.writeText = async function(text) {
      captureClipboardText(text);
      return Promise.resolve();
    };
  }

  if (navigator.clipboard.write) {
    navigator.clipboard.write = async function(items) {
      if (!interceptorActive || !items || !currentTarget) {
        return Promise.resolve();
      }

      try {
        for (const item of items) {
          if (item.types?.includes('text/plain')) {
            const blob = await item.getType('text/plain');
            const text = await blob.text();
            captureClipboardText(text);
            break;
          }
        }
      } catch {
        // Silent by design. Missing messages are handled at the end.
      }

      return Promise.resolve();
    };
  }

  function getScrollContainer() {
    const feed = document.querySelector(SELECTORS.feed);
    let el = feed;

    while (el && el !== document.body && el !== document.documentElement) {
      const style = getComputedStyle(el);
      const canScroll = /(auto|scroll)/.test(style.overflowY);

      if (canScroll && el.scrollHeight > el.clientHeight) {
        return el;
      }

      el = el.parentElement;
    }

    return document.scrollingElement || document.documentElement;
  }

  function getScrollTop(scroller) {
    if (
      scroller === document.scrollingElement ||
      scroller === document.documentElement ||
      scroller === document.body
    ) {
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    return scroller.scrollTop;
  }

  function setScrollTop(scroller, y) {
    if (
      scroller === document.scrollingElement ||
      scroller === document.documentElement ||
      scroller === document.body
    ) {
      window.scrollTo(0, y);
    } else {
      scroller.scrollTop = y;
    }
  }

  function getScrollHeight(scroller) {
    if (
      scroller === document.scrollingElement ||
      scroller === document.documentElement ||
      scroller === document.body
    ) {
      return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    }

    return scroller.scrollHeight;
  }

  function getClientHeight(scroller) {
    if (
      scroller === document.scrollingElement ||
      scroller === document.documentElement ||
      scroller === document.body
    ) {
      return window.innerHeight;
    }

    return scroller.clientHeight;
  }

  async function waitForCapture(position, timeoutMs = SETTINGS.captureTimeoutMs) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      if (capturedByPosition.has(position)) return true;
      await delay(100);
    }

    return false;
  }

  async function clickLoadButtons() {
    const buttons = [...document.querySelectorAll('button')]
      .filter(btn => SELECTORS.loadButtonText.test(btn.textContent || ''));

    for (const btn of buttons) {
      try {
        btn.click();
        await delay(800);
      } catch {
        // Silent by design.
      }
    }
  }

  async function copyOneArticleOnce(article, position) {
    if (capturedByPosition.has(position)) return true;

    const kind = registerArticle(article, position);

    if (kind === 'ignore') {
      updateStatus(`Skipping non-exportable Claude status/timeline entry ${position}`);
      return false;
    }

    if (isAttemptExhausted(position)) {
      skippedByPosition.set(position, `Skipped after ${SETTINGS.maxAttemptsPerMessage} failed attempts.`);
      return false;
    }

    const copyButton = article.querySelector(SELECTORS.copyButton);

    if (!copyButton) {
      skippedByPosition.set(position, 'No copy button mounted.');
      return false;
    }

    const attempt = incrementAttemptCount(position);

    currentTarget = {
      position,
      type: kind,
      attempt
    };

    updateStatus(
      `Copying message ${position} (${kind})\n` +
      `Attempt ${attempt}/${SETTINGS.maxAttemptsPerMessage}`
    );

    try {
      article.scrollIntoView({ behavior: 'instant', block: 'center' });
      await delay(SETTINGS.afterScrollIntoViewMs);

      copyButton.focus?.();
      await delay(80);

      copyButton.click();

      const captured = await waitForCapture(position);

      currentTarget = null;

      if (!captured) {
        if (isAttemptExhausted(position)) {
          skippedByPosition.set(position, `Failed after ${SETTINGS.maxAttemptsPerMessage} attempts.`);
        } else {
          skippedByPosition.set(position, 'Clicked but not captured yet.');
        }

        await delay(SETTINGS.afterFailedCapturePauseMs);
        return false;
      }

      await delay(SETTINGS.betweenMessagesMs);
      return true;
    } catch {
      currentTarget = null;

      if (isAttemptExhausted(position)) {
        skippedByPosition.set(position, `Click failed after ${SETTINGS.maxAttemptsPerMessage} attempts.`);
      } else {
        skippedByPosition.set(position, 'Click failed.');
      }

      await delay(SETTINGS.afterFailedCapturePauseMs);
      return false;
    }
  }

  async function processMountedArticles(onlyPositions = null) {
    const mounted = getMountedArticles();
    let processed = 0;

    for (const { article, position } of mounted) {
      const kind = registerArticle(article, position);

      if (kind === 'ignore') continue;
      if (capturedByPosition.has(position)) continue;
      if (isAttemptExhausted(position)) continue;
      if (onlyPositions && !onlyPositions.has(position)) continue;

      const ok = await copyOneArticleOnce(article, position);

      if (ok) {
        processed++;
      }
    }

    currentTarget = null;
    return processed;
  }

  async function scanOnce(scroller, direction, passLabel) {
    const clientHeight = getClientHeight(scroller);
    const step = Math.max(
      SETTINGS.minimumScrollStepPx,
      Math.floor(clientHeight * SETTINGS.scrollStepRatio)
    );

    let maxScroll = Math.max(0, getScrollHeight(scroller) - clientHeight);

    const points = [];

    if (direction === 'down') {
      for (let y = 0; y <= maxScroll + step; y += step) {
        points.push(Math.min(y, maxScroll));
      }
    } else {
      for (let y = maxScroll; y >= -step; y -= step) {
        points.push(Math.max(0, y));
      }
    }

    for (const y of points) {
      setScrollTop(scroller, y);
      await delay(SETTINGS.scrollDelayMs);
      await clickLoadButtons();

      maxScroll = Math.max(0, getScrollHeight(scroller) - getClientHeight(scroller));

      updateStatus(
        `Pass ${passLabel}: scanning ${direction}\n` +
        `Scroll: ${Math.round(getScrollTop(scroller))}/${Math.round(maxScroll)}`
      );

      await processMountedArticles();

      const missing = getKnownMissingPositions();
      const retryable = getRetryableMissingPositions();

      if (knownExportablePositions.size > 0 && missing.length === 0) {
        return true;
      }

      if (knownExportablePositions.size > 0 && missing.length > 0 && retryable.length === 0) {
        return true;
      }
    }

    return false;
  }

  async function scrollAndCaptureAll() {
    const feed = document.querySelector(SELECTORS.feed);

    if (!feed) {
      throw new Error('Claude chat feed not found. Open a Claude conversation first.');
    }

    const scroller = getScrollContainer();

    let lastCaptured = -1;
    let lastKnownExportable = -1;
    let stagnantPasses = 0;

    for (let pass = 1; pass <= SETTINGS.maxFullPasses; pass++) {
      updateStatus(`Starting pass ${pass}/${SETTINGS.maxFullPasses}`);

      await scanOnce(scroller, 'down', pass);
      await scanOnce(scroller, 'up', pass);

      const counts = getCounts();

      const noNewCaptured = counts.total === lastCaptured;
      const noNewKnownExportable = knownExportablePositions.size === lastKnownExportable;

      if (noNewCaptured && noNewKnownExportable) {
        stagnantPasses++;
      } else {
        stagnantPasses = 0;
        lastCaptured = counts.total;
        lastKnownExportable = knownExportablePositions.size;
      }

      const missing = getKnownMissingPositions();
      const retryable = getRetryableMissingPositions();

      if (knownExportablePositions.size > 0 && missing.length === 0 && stagnantPasses >= 1) {
        break;
      }

      if (knownExportablePositions.size > 0 && missing.length > 0 && retryable.length === 0) {
        break;
      }

      if (stagnantPasses >= SETTINGS.stagnantPassLimit) {
        break;
      }
    }

    return {
      knownExportable: knownExportablePositions.size,
      ignored: ignoredByPosition.size
    };
  }

  function buildMarkdown(timestamps) {
    let markdown = '# Conversation with Claude\n\n';

    const messages = [...capturedByPosition.values()]
      .sort((a, b) => a.position - b.position);

    for (const msg of messages) {
      if (msg.type === 'human') {
        const ts = timestamps?.get(msg.content?.trim());
        const header = ts ? `## Human (${ts}):` : '## Human:';

        markdown += `${header}\n\n${msg.content}\n\n---\n\n`;
      } else {
        markdown += `## Claude:\n\n${msg.content}\n\n---\n\n`;
      }
    }

    return markdown;
  }

  function buildReport(scanResult) {
    const missing = getKnownMissingPositions();
    const capturedPositions = [...capturedByPosition.keys()].sort((a, b) => a - b);

    return {
      version: VERSION,
      knownExportable: scanResult.knownExportable,
      captured: capturedPositions.length,
      ignored: scanResult.ignored,
      missing,
      capturedPositions,
      ignoredPositions: [...ignoredByPosition.entries()],
      attempts: [...attemptCountByPosition.entries()],
      skipped: [...skippedByPosition.entries()]
    };
  }

  function cleanup() {
    interceptorActive = false;
    currentTarget = null;

    try {
      if (originalWriteText) {
        navigator.clipboard.writeText = originalWriteText;
      }

      if (originalWrite) {
        navigator.clipboard.write = originalWrite;
      }
    } catch {
      // Silent cleanup.
    }
  }

  try {
    updateStatus('Fetching conversation metadata...');

    conversationData = await fetchConversationData();
    const timestamps = getMessageTimestamps(conversationData);

    if (conversationData) {
      logInfo(`Got timestamps for ${timestamps.size} human messages.`);
    }

    updateStatus('Starting scroll capture...');

    const scanResult = await scrollAndCaptureAll();
    const counts = getCounts();
    const report = buildReport(scanResult);

    if (counts.total === 0) {
      throw new Error('No messages captured. Claude DOM may have changed, or copy buttons are unavailable.');
    }

    const markdown = buildMarkdown(timestamps);
    const filename = `${getConversationTitle()}.md`;

    downloadMarkdown(markdown, filename);

    if (report.missing.length === 0) {
      statusDiv.style.background = '#4CAF50';
      updateStatus(
        `SUCCESS\n` +
        `Downloaded: ${filename}\n` +
        `Ignored non-exportable entries: ${report.ignored}`
      );
      logInfo('Export successful.');
      logInfo(`Human: ${counts.human}, Claude: ${counts.claude}, Total: ${counts.total}`);
      logInfo('Export report:', report);
    } else {
      statusDiv.style.background = '#ff9800';
      updateStatus(
        `PARTIAL EXPORT\n` +
        `Downloaded: ${filename}\n` +
        `Missing exportable positions: ${report.missing.join(', ')}\n` +
        `Ignored non-exportable entries: ${report.ignored}`
      );
      logWarn('Partial export report:', report);
    }
  } catch (error) {
    fatalError = error;
    statusDiv.style.background = '#f44336';
    statusDiv.textContent = `Claude Web Chat Conversation Exporter ${VERSION}\nERROR: ${error.message}`;
    logError('Export failed:', error);
  } finally {
    cleanup();

    if (!fatalError) {
      setTimeout(() => {
        if (document.body.contains(statusDiv)) {
          document.body.removeChild(statusDiv);
        }
      }, SETTINGS.statusRemoveDelayMs);
    }
  }
}

setupClaudeExporter();