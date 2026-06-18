import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

const redirectTo = AuthSession.makeRedirectUri({ scheme: "greencoatvets" });

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (!access_token) throw new Error("Google sign-in did not return a session.");
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

/** Google OAuth — same Supabase provider as the marketing website. */
export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Could not start Google sign-in.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") {
    throw new Error("Google sign-in was cancelled.");
  }
  await createSessionFromUrl(result.url);
}

export async function linkPrimaryClinicAfterAuth(fullName?: string | null, phone?: string | null) {
  const { error } = await supabase.rpc("ensure_primary_clinic_customer_membership", {
    p_full_name: fullName?.trim() || null,
    p_phone: phone?.trim() || null,
  });
  if (error) {
    console.warn("ensure_primary_clinic_customer_membership:", error.message);
  }
}
