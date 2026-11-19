/**
 * Connection to Supabase for online play. The SDK is loaded only when someone opens
 * online mode, so the single-phone app does not grow. Without the build-time settings
 * (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY) online mode is simply hidden.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const onlineAvailable = (): boolean => Boolean(URL && KEY);

let client: Promise<SupabaseClient> | null = null;

export function getClient(): Promise<SupabaseClient> {
  if (!URL || !KEY) return Promise.reject(new Error("online play is not configured"));
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "mis-juegos:auth" },
    }),
  );
  return client;
}

/** The phone's user id, signing in anonymously the first time (no account needed). */
export async function signIn(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = await getClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return { supabase, userId: data.session.user.id };
  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error || !created.user) throw error ?? new Error("sign-in failed");
  return { supabase, userId: created.user.id };
}
