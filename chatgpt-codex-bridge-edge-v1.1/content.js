const PACKET_LABEL = 'context-packet';
let lastPacketHash = '';
let debounceTimer = null;

function simpleHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function looksLikePacketText(text) {
  if (!text) return false;
  return (
    text.includes('project_id:') &&
    text.includes('cycle_id:') &&
    text.includes('stage:') &&
    text.includes('goal:') &&
    text.includes('next_action:')
  );
}

function normalizeFenceContent(rawText) {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  if (lines.length === 0) return null;

  const firstLine = lines[0].trim().toLowerCase();
  if (!firstLine.startsWith('```' + PACKET_LABEL)) return null;

  const endFenceIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '```');
  if (endFenceIndex === -1) return null;

  const content = lines.slice(1, endFenceIndex).join('\n').trim();
  return looksLikePacketText(content) ? content : null;
}

function extractPacketFromRenderedText(rawText) {
  if (!rawText) return null;
  const text = rawText.replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const current = lines[i].trim().toLowerCase();
    if (current !== PACKET_LABEL) continue;

    const collected = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      const trimmed = line.trim();

      if (!trimmed && collected.length === 0) continue;
      if (!trimmed && collected.length > 0) break;

      if (
        trimmed.startsWith('project_id:') ||
        trimmed.startsWith('cycle_id:') ||
        trimmed.startsWith('stage:') ||
        trimmed.startsWith('goal:') ||
        trimmed.startsWith('constraints:') ||
        trimmed.startsWith('- ') ||
        trimmed.startsWith('next_action:')
      ) {
        collected.push(line);
        continue;
      }

      // Ignore a few common UI strings that may appear around code blocks.
      if (/^copy$/i.test(trimmed)) continue;

      break;
    }

    const candidate = collected.join('\n').trim();
    if (looksLikePacketText(candidate)) return candidate;
  }

  return null;
}

function extractPacketFromRawText(rawText) {
  if (!rawText) return null;
  const marker = '```' + PACKET_LABEL;
  const startIndex = rawText.lastIndexOf(marker);
  if (startIndex === -1) return null;

  const candidate = rawText.slice(startIndex);
  return normalizeFenceContent(candidate);
}

function getLatestCandidates() {
  const selectors = [
    'article',
    '[data-message-author-role="assistant"]',
    'main',
    'pre code',
    'code'
  ];

  const nodes = [];
  for (const selector of selectors) {
    nodes.push(...document.querySelectorAll(selector));
  }

  return Array.from(new Set(nodes)).slice(-20);
}

function findLatestPacket() {
  const candidates = getLatestCandidates();

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const text = candidates[i].innerText || candidates[i].textContent || '';
    const packet = extractPacketFromRawText(text) || extractPacketFromRenderedText(text);
    if (packet) return packet;
  }

  const wholePageText = document.body?.innerText || document.body?.textContent || '';
  return extractPacketFromRawText(wholePageText) || extractPacketFromRenderedText(wholePageText);
}

async function sendPacket(packetText) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'WEB_CONTEXT_PACKET',
      payload: {
        packet: packetText,
        capturedAt: new Date().toISOString(),
        pageUrl: location.href,
        pageTitle: document.title,
        userAgent: navigator.userAgent
      }
    });
    console.log('Packet sent to extension background:', response);
  } catch (error) {
    console.error('Failed to send packet to extension background:', error);
  }
}

function tryCapturePacket() {
  const packet = findLatestPacket();
  if (!packet) return;

  const packetHash = simpleHash(packet);
  if (packetHash === lastPacketHash) return;

  lastPacketHash = packetHash;
  sendPacket(packet);
}

function scheduleCapture() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(tryCapturePacket, 900);
}

const observer = new MutationObserver(() => {
  scheduleCapture();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true
});

scheduleCapture();
console.log('ChatGPT Codex Bridge for Edge v1.1 content script loaded.');
