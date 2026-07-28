import { createBrowserClient } from "@supabase/ssr";

import {
  getSupabasePublicConfig,
  type SupabasePublicConfig,
} from "./config.ts";

export function createSupabaseBrowserClient(
  config: SupabasePublicConfig = getSupabasePublicConfig(),
) {
  if (config.status !== "configured") return null;

  return createBrowserClient(config.url, config.publishableKey);
}
