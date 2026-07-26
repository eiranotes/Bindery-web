type HeaderReader = Pick<Headers, "get">;

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function siteUrlFromHeaders(requestHeaders: HeaderReader): URL {
  const host =
    firstHeaderValue(requestHeaders.get("x-forwarded-host")) ??
    firstHeaderValue(requestHeaders.get("host"));
  const forwardedProtocol = firstHeaderValue(
    requestHeaders.get("x-forwarded-proto"),
  );
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host?.startsWith("localhost") || host?.startsWith("127.0.0.1")
        ? "http"
        : "https";

  if (host) {
    try {
      return new URL(`${protocol}://${host}`);
    } catch {
      // Fall through to the explicitly configured origin.
    }
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    if (configuredOrigin) return new URL(configuredOrigin);
  } catch {
    // Local fallback keeps builds inspectable when an invalid value is supplied.
  }

  return new URL("http://localhost:3000");
}
