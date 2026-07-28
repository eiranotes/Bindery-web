export type PublicEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: string | undefined;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string | undefined;
};

export type SupabasePublicConfig =
  | {
      status: "configured";
      url: string;
      publishableKey: string;
    }
  | {
      status: "unconfigured";
      missing: (keyof PublicEnvironment)[];
      invalid: (keyof PublicEnvironment)[];
    };

function currentPublicEnvironment(): PublicEnvironment {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

function normalizeSupabaseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost");

    if (url.protocol !== "https:" && !isLocalHttp) return null;
    if (url.username || url.password || url.search || url.hash) return null;

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getSupabasePublicConfig(
  environment: PublicEnvironment = currentPublicEnvironment(),
): SupabasePublicConfig {
  const urlValue = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const missing: (keyof PublicEnvironment)[] = [];
  const invalid: (keyof PublicEnvironment)[] = [];

  if (!urlValue) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  const url = urlValue ? normalizeSupabaseUrl(urlValue) : null;
  if (urlValue && !url) invalid.push("NEXT_PUBLIC_SUPABASE_URL");

  if (missing.length > 0 || invalid.length > 0 || !url || !publishableKey) {
    return { status: "unconfigured", missing, invalid };
  }

  return {
    status: "configured",
    url,
    publishableKey,
  };
}
