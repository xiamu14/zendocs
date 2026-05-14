export type ZendocsMatchRule =
  | string
  | RegExp
  | {
      type: "string";
      value: string;
    }
  | {
      type: "regex";
      pattern: string;
      flags?: string;
    }
  | {
      type: "glob";
      pattern: string;
    };

export type ZendocsEditorConfig = {
  command: string;
  args?: string[];
  url?: string;
};

export type ZendocsConfig = {
  readDirectory: string;
  editor?: ZendocsEditorConfig | false;
  filterFiles?: ZendocsMatchRule[];
  filterDirectories?: ZendocsMatchRule[];
  maxFileSizeBytes?: number;
};

function normalizePath(value: string) {
  return value.replaceAll("\\", "/");
}

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegex(pattern: string) {
  const segments = normalizePath(pattern).split("/");
  let source = "^";
  let needsSlash = false;

  function segmentToRegex(segment: string) {
    let segmentSource = "";

    for (let index = 0; index < segment.length; index += 1) {
      const char = segment[index];

      if (char === "*") {
        segmentSource += "[^/]*";
        continue;
      }

      if (char === "?") {
        segmentSource += "[^/]";
        continue;
      }

      segmentSource += escapeRegex(char);
    }

    return segmentSource;
  }

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];

    if (segment === "**") {
      if (index === 0) {
        source += "(?:[^/]+/)*";
        continue;
      }

      source += index === segments.length - 1 ? "(?:/.*)?" : "(?:/[^/]+)*";
      needsSlash = true;
      continue;
    }

    if (needsSlash) source += "/";
    source += segmentToRegex(segment);
    needsSlash = true;
  }

  return new RegExp(`${source}$`);
}

function matchesRule(rule: ZendocsMatchRule, candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizePath);

  if (typeof rule === "string") {
    return normalizedCandidates.some((candidate) => candidate.includes(rule));
  }

  if (rule instanceof RegExp) {
    return normalizedCandidates.some((candidate) => {
      rule.lastIndex = 0;
      return rule.test(candidate);
    });
  }

  if (rule.type === "string") {
    return normalizedCandidates.some((candidate) =>
      candidate.includes(rule.value),
    );
  }

  if (rule.type === "regex") {
    const regex = new RegExp(rule.pattern, rule.flags);
    return normalizedCandidates.some((candidate) => regex.test(candidate));
  }

  const regex = globToRegex(rule.pattern);
  return normalizedCandidates.some((candidate) => regex.test(candidate));
}

export function matchesAnyRule(
  rules: ZendocsMatchRule[] | undefined,
  candidates: string[],
) {
  return rules?.some((rule) => matchesRule(rule, candidates)) ?? false;
}
