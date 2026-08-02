export function safeCommunityReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return "/community";
  }

  let decoded = value;
  for (let depth = 0; depth < 4; depth += 1) {
    if (decoded.startsWith("//") || decoded.startsWith("/\\")) {
      return "/community";
    }

    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return "/community";
    }
  }

  if (decoded.startsWith("//") || decoded.startsWith("/\\")) {
    return "/community";
  }

  try {
    const base = new URL("https://bindery.invalid");
    const resolved = new URL(value, base);
    if (resolved.origin !== base.origin) return "/community";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/community";
  }
}
