import { DATA_SHARING_CONSENT_KEY } from "@saasclinics/lib";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ClinicalWindowsProvider } from "@/components/clinical/clinical-windows-context";
import { ClinicalWindowsLayerLazy } from "@/components/clinical/clinical-windows-layer-lazy";
import { DataConsentModal, ProfileGateClient } from "@/components/web/portal-gates-client";
import { getProfileCompletionState } from "@/lib/auth/profile-completion";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";

/**
 * Route group: URLs are unchanged (group name is omitted).
 * Shared Suspense boundary via `loading.tsx` so client navigations between
 * dashboard, branches, appointments, etc. show the paw loader while RSC loads.
 */
export default async function PortalGroupLayout({ children }: { children: ReactNode }) {
  const access = await getUserAccess();
  const supabase = createClient();
  const [profile, consentRow] = await Promise.all([
    getProfileCompletionState(supabase, access),
    supabase
      .from("user_consents")
      .select("id")
      .eq("user_id", access.userId)
      .eq("consent_key", DATA_SHARING_CONSENT_KEY)
      .maybeSingle(),
  ]);

  const consentAccepted = Boolean(consentRow.data);

  return (
    <ClinicalWindowsProvider>
      <ProfileGateClient profileComplete={profile.complete} />
      <DataConsentModal initialAccepted={consentAccepted} />
      {children}
      <Suspense fallback={null}>
        <ClinicalWindowsLayerLazy />
      </Suspense>
    </ClinicalWindowsProvider>
  );
}
