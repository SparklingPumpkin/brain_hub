export function parseStrategyPacket(rawText) {
  const parsed = {};
  let currentListKey = null;

  for (const rawLine of String(rawText).split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const keyMatch = trimmed.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (keyMatch) {
      const [, key, value] = keyMatch;
      if (value === "") {
        parsed[key] = [];
        currentListKey = key;
      } else {
        parsed[key] = value.trim();
        currentListKey = null;
      }
      continue;
    }

    const listMatch = trimmed.match(/^-\s+(.+)$/);
    if (listMatch && currentListKey) {
      if (!Array.isArray(parsed[currentListKey])) {
        parsed[currentListKey] = [];
      }
      parsed[currentListKey].push(listMatch[1].trim());
    }
  }

  return parsed;
}
