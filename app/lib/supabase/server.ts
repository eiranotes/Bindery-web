import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import {
  getSupabasePublicConfig,
  type SupabasePublicConfig,
} from "./config.ts";

export async function createSupabaseServerClient(
  config: SupabasePublicConfig = getSupabasePublicConfig(),
) {
  if (config.status !== "configured") return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always write response cookies. Auth routes
          // call this client before committing a response and can write them.
        }
      },
    },
  });
}
