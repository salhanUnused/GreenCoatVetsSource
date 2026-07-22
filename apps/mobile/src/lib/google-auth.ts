import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { ensurePrimaryClinicMembership } from "./ensure-clinic-membership";
import { forceAssignOnlyClinic } from "./membership";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export const AUTH_CALLBACK_PATH = "auth/callback";
export const MOBILE_APP_CALLBACK = "greencoatvets://auth/callback";

/**
 * HTTPS redirect Supabase already allows for greencoatvets.com — the in-app browser
 * closes on this URL and we exchange the PKCE code in the app (no website session).
 */
export function getGoogleOAuthRedirectUri(): string {
  const website = process.env.EXPO_PUBLIC_WEBSITE_URL?.trim().replace(/\/$/, "");
  if (website) return `${website}/auth/mobile-callback`;
  return makeRedirectUri({ scheme: "greencoatvets", path: AUTH_CALLBACK_PATH });
}

function parseAuthCallbackUrl(url: string): {
  code?: string;
  access_token?: string;
  refresh_token?: string;
  error?: string;
} {
  let code: string | undefined;
  let access_token: string | undefined;
  let refresh_token: string | undefined;
  let error: string | undefined;

  try {
    const u = new URL(url);
    code = u.searchParams.get("code") ?? undefined;
    error = u.searchParams.get("error") ?? u.searchParams.get("error_description") ?? undefined;
    if (u.hash) {
      const hash = new URLSearchParams(u.hash.replace(/^#/, ""));
      access_token = hash.get("access_token") ?? undefined;
      refresh_token = hash.get("refresh_token") ?? undefined;
      error = error ?? hash.get("error") ?? hash.get("error_description") ?? undefined;
    }
  } catch {
    /* fall through to Linking.parse */
  }

  if (!code && !access_token) {
    const parsed = Linking.parse(url);
    const qp = parsed.queryParams ?? {};
    code = typeof qp.code === "string" ? qp.code : undefined;
    access_token = typeof qp.access_token === "string" ? qp.access_token : undefined;
    refresh_token = typeof qp.refresh_token === "string" ? qp.refresh_token : undefined;
    error =
      typeof qp.error === "string"
        ? qp.error
        : typeof qp.error_description === "string"
          ? qp.error_description
          : error;
    if (!access_token && url.includes("#")) {
      const hash = url.slice(url.indexOf("#") + 1);
      const hashParams = new URLSearchParams(hash);
      access_token = hashParams.get("access_token") ?? undefined;
      refresh_token = hashParams.get("refresh_token") ?? undefined;
    }
  }

  return { code, access_token, refresh_token, error };
}

/** Parse OAuth callback URL and persist Supabase session (exported for Linking listener). */
export async function createSessionFromUrl(url: string): Promise<void> {
  const { code, access_token, refresh_token, error } = parseAuthCallbackUrl(url);
  if (error) throw new Error(error);

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return;
  }

  if (!access_token) throw new Error("Google sign-in did not return a session.");
  const { error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token ?? "",
  });
  if (sessionError) throw sessionError;
}

export function isOAuthCallbackUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith(MOBILE_APP_CALLBACK) || url.includes("greencoatvets://")) return true;
  if (url.includes("/auth/mobile-callback")) return true;
  return url.includes(AUTH_CALLBACK_PATH);
}

/** Google OAuth in an in-app browser tab; session is created in the mobile app only. */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = getGoogleOAuthRedirectUri();
  if (!redirectTo) {
    throw new Error("Set EXPO_PUBLIC_WEBSITE_URL (e.g. https://greencoatvets.com) for Google sign-in.");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Could not start Google sign-in.");

  let sessionDone: Promise<void> | null = null;
  const finishAuth = (callbackUrl: string) => {
    if (!sessionDone) sessionDone = createSessionFromUrl(callbackUrl);
    return sessionDone;
  };

  const linkingSub = Linking.addEventListener("url", ({ url }) => {
    if (!isOAuthCallbackUrl(url)) return;
    void finishAuth(url);
  });

  try {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
      preferEphemeralSession: true,
      showInRecents: false,
    });

    if (result.type === "success" && result.url) {
      await finishAuth(result.url);
      return;
    }
    if (result.type === "cancel" || result.type === "dismiss") {
      throw new Error("Google sign-in was cancelled.");
    }

    if (sessionDone) {
      await sessionDone;
      return;
    }

    const initial = await Linking.getInitialURL();
    if (initial && isOAuthCallbackUrl(initial)) {
      await finishAuth(initial);
      return;
    }

    throw new Error(
      "Google sign-in did not return to the app. Deploy the website with /auth/mobile-callback and set EXPO_PUBLIC_WEBSITE_URL=https://greencoatvets.com",
    );
  } finally {
    linkingSub.remove();
    void WebBrowser.coolDownAsync();
  }
}

export async function linkPrimaryClinicAfterAuth(fullName?: string | null, phone?: string | null) {
  try {
    const clinicId = await ensurePrimaryClinicMembership(fullName, phone);
    if (clinicId) return clinicId;
  } catch (e) {
    console.warn("ensure_primary_clinic_customer_membership", e instanceof Error ? e.message : e);
  }
  try {
    return await forceAssignOnlyClinic("pet_owner");
  } catch (e) {
    console.warn("force_assign_only_clinic_membership", e instanceof Error ? e.message : e);
    return null;
  }
}
