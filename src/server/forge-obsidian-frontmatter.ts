type ParsedFrontmatter = Record<string, string>;

const FRONTMATTER_START = "---\n";
const FRONTMATTER_END = "\n---\n";

function normalizeFrontmatterContent(content: string) {
  return content.replace(/^\uFEFF/, "");
}

function locateFrontmatter(content: string) {
  const normalized = normalizeFrontmatterContent(content);

  if (!normalized.startsWith(FRONTMATTER_START)) {
    return {
      normalized,
      start: -1,
      end: -1,
    };
  }

  const end = normalized.indexOf(FRONTMATTER_END, FRONTMATTER_START.length);

  return {
    normalized,
    start: 0,
    end,
  };
}

export function parseObsidianFrontmatter(content: string): ParsedFrontmatter {
  const location = locateFrontmatter(content);

  if (location.end === -1) {
    return {};
  }

  return location.normalized
    .slice(FRONTMATTER_START.length, location.end)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<ParsedFrontmatter>((result, line) => {
      const separator = line.indexOf(":");

      if (separator === -1) {
        return result;
      }

      const key = line.slice(0, separator).trim();
      const rawValue = line.slice(separator + 1).trim();
      result[key] = rawValue.replace(/^["']|["']$/g, "");
      return result;
    }, {});
}

export function stripObsidianFrontmatter(content: string) {
  const location = locateFrontmatter(content);

  if (location.end === -1) {
    return location.normalized;
  }

  return location.normalized.slice(location.end + FRONTMATTER_END.length);
}

export function replaceObsidianBody(content: string, body: string) {
  const location = locateFrontmatter(content);
  const nextBody = normalizeFrontmatterContent(body).replace(/^\n+/, "");

  if (location.end === -1) {
    return nextBody;
  }

  return `${location.normalized.slice(0, location.end + FRONTMATTER_END.length)}${nextBody}`;
}

function renderFrontmatterValue(value: boolean | string) {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function updateObsidianFrontmatter(
  content: string,
  updates: Record<string, boolean | string | null>
) {
  const location = locateFrontmatter(content);
  const body =
    location.end === -1
      ? location.normalized
      : location.normalized.slice(location.end + FRONTMATTER_END.length);
  const originalLines =
    location.end === -1
      ? []
      : location.normalized
          .slice(FRONTMATTER_START.length, location.end)
          .split("\n")
          .filter((line) => line.length > 0);
  const remainingUpdates = new Map(Object.entries(updates));
  const nextLines: string[] = [];

  originalLines.forEach((line) => {
    const separator = line.indexOf(":");

    if (separator === -1) {
      nextLines.push(line);
      return;
    }

    const key = line.slice(0, separator).trim();

    if (!remainingUpdates.has(key)) {
      nextLines.push(line);
      return;
    }

    const nextValue = remainingUpdates.get(key);
    remainingUpdates.delete(key);

    if (nextValue === null || nextValue === undefined) {
      return;
    }

    nextLines.push(`${key}: ${renderFrontmatterValue(nextValue)}`);
  });

  remainingUpdates.forEach((value, key) => {
    if (value === null || value === undefined) {
      return;
    }

    nextLines.push(`${key}: ${renderFrontmatterValue(value)}`);
  });

  if (nextLines.length === 0) {
    return body;
  }

  return `${FRONTMATTER_START}${nextLines.join("\n")}${FRONTMATTER_END}${body}`;
}
