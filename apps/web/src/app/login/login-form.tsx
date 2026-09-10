"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/PasswordField";
import { mapAuthError } from "@/lib/auth/map-auth-error";
import { loginHintMessage } from "@/lib/auth/login-hints";
import { resolveWebPortalLoginRoutingAction } from "./auth-routing-actions";
import { beginPortalLoginOtpAction } from "./otp-actions";

export function LoginForm({
  productName,
  logoUrl,
}: {
  productName: string;
  logoUrl: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const invite = (searchParams.get("invite") ?? "").trim();
  const passwordReset = searchParams.get("reset") === "1";
  const hintMessage = loginHintMessage(searchParams.get("hint"));
  const oauthErrorCode = searchParams.get("error");
  const oauthErrorMessage = searchParams.get("message");

  useEffect(() => {
    if (oauthErrorCode) {
      setError(oauthErrorMessage ?? mapAuthError(oauthErrorCode));
    }
  }, [oauthErrorCode, oauthErrorMessage]);

  const finishWebPortalSignIn = useCallback(
    async (emailHint: string, isCancelled?: () => boolean) => {
      const routing = await resolveWebPortalLoginRoutingAction();
      if (isCancelled?.()) return;
      if (!routing.ok) {
        setIsSubmitting(false);
        setError(routing.error);
        return;
      }
      if (routing.kind === "external") {
        window.location.assign(routing.url);
        return;
      }

      const otpResult = await beginPortalLoginOtpAction(emailHint);
      if (isCancelled?.()) return;
      if (!otpResult.ok) {
        setIsSubmitting(false);
        setError(otpResult.error);
        return;
      }

      setIsSubmitting(false);
      router.replace(`/login/verify-email?next=${encodeURIComponent(routing.next)}`);
      router.refresh();
    },
    [router],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setIsSubmitting(false);
      setError(mapAuthError(signInError.message));
      return;
    }

    if (invite) {
      const { error: inviteError } = await supabase.rpc("consume_clinic_role_invite", {
        p_token: invite,
        p_full_name: null,
        p_phone: null,
      });
      if (inviteError) {
        setIsSubmitting(false);
        setError(mapAuthError(inviteError.message));
        return;
      }
    }

    await finishWebPortalSignIn(email);
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated gradient base */}
      <div className="absolute inset-0 login-bg-gradient" aria-hidden />

      {/* Drifting dot grid */}
      <div className="pointer-events-none absolute inset-0 login-dots opacity-50" aria-hidden />

      {/* Soft floating blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="login-blob login-blob-1 absolute -left-[18%] top-[8%] h-[min(85vw,520px)] w-[min(85vw,520px)] rounded-full bg-primary-container/50" />
        <div className="login-blob login-blob-2 absolute -right-[12%] bottom-[0%] h-[min(75vw,440px)] w-[min(75vw,440px)] rounded-full bg-secondary-container/45" />
        <div className="login-blob login-blob-3 absolute bottom-[18%] left-[15%] h-[min(55vw,320px)] w-[min(55vw,320px)] rounded-full bg-tertiary-fixed/35" />
        <div className="login-blob login-blob-4 absolute right-[8%] top-[38%] h-[min(40vw,240px)] w-[min(40vw,240px)] rounded-full bg-primary/25" />
      </div>

      {/* Slow rotating rings (depth) */}
      <div className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2" aria-hidden>
        <div className="login-orbit h-[min(95vw,640px)] w-[min(95vw,640px)] rounded-full border border-primary/12" />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2" aria-hidden>
        <div className="login-orbit-reverse h-[min(75vw,480px)] w-[min(75vw,480px)] rounded-full border border-secondary/10" />
      </div>

      {/* Floating chips (static accents — no infinite pulse) */}
      <div
        className="pointer-events-none absolute left-[8%] top-[22%] h-3 w-16 rounded-full bg-primary-container/40 shadow-sm"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[12%] top-[30%] h-2 w-12 rounded-full bg-secondary-container/50"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[24%] right-[18%] h-4 w-20 rounded-full bg-tertiary-fixed/40"
        aria-hidden
      />

      <header className="relative z-20 flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-contain" />
          ) : null}
          <p className="font-headline max-w-[min(100%,320px)] text-sm font-extrabold leading-snug text-primary sm:max-w-lg sm:text-base">
            {productName}
          </p>
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 pb-16 pt-4">
        <div className="w-full max-w-md">
          <form
            className="glass-card relative rounded-2xl border border-white/60 p-8 shadow-[0_24px_64px_-12px_rgba(23,28,31,0.12)] backdrop-blur-xl"
            onSubmit={onSubmit}
          >
            <div className="mb-8 text-center">
              <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-background">Welcome back</h1>
              <p className="mt-2 text-sm text-on-surface-variant">Secure access to your clinic workspace.</p>
              {invite ? (
                <p className="mt-2 text-xs font-semibold text-primary">
                  Invite detected. Your role assignment will be applied after sign in.
                </p>
              ) : null}
              {passwordReset ? (
                <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                  Password updated. Sign in with your new password.
                </p>
              ) : null}
              {hintMessage ? (
                <p className="mt-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">
                  {hintMessage}
                </p>
              ) : null}
            </div>

            <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs font-semibold text-primary">
              Google sign-in is available on the public website only. Use email and password for web portal login.
            </div>

            <div className="space-y-4">
              <input
                className="input-soft w-full px-4 py-4"
                type="email"
                placeholder="Work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <PasswordField
                inputClassName="input-soft w-full px-4 py-4"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <p className="text-right text-sm">
                <Link className="font-semibold text-primary hover:underline" href="/forgot-password">
                  Forgot password?
                </Link>
              </p>
              {error ? <p className="text-sm text-error">{error}</p> : null}
              <button className="btn-primary w-full py-4 disabled:opacity-60" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing in…" : "Sign in"}
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-on-surface-variant">
              New user?{" "}
              <Link className="font-bold text-primary hover:underline" href="/signup">
                Create account
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
