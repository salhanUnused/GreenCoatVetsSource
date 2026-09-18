"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { WebsiteConsentModal } from "@/components/consent/website-consent-modal";
import { CartProvider } from "@/components/store/cart-context";
import { StoreCartChrome } from "@/components/store/cart-drawer";
import { createClient } from "@/lib/supabase/client";

function CartChromeGate({ storeEnabled }: { storeEnabled: boolean }) {
  const path = usePathname();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    if (!storeEnabled) return;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setIsAuthed(Boolean(data.user)));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session?.user));
    });
    return () => subscription.unsubscribe();
  }, [storeEnabled]);

  if (path.startsWith("/admin")) return null;
  if (!storeEnabled) return null;
  if (!isAuthed) return null;
  return <StoreCartChrome />;
}

export function StoreProviders({ children, storeEnabled }: { children: ReactNode; storeEnabled: boolean }) {
  if (!storeEnabled) {
    return (
      <>
        {children}
        <WebsiteConsentModal />
      </>
    );
  }

  return (
    <CartProvider>
      {children}
      <CartChromeGate storeEnabled={storeEnabled} />
      <WebsiteConsentModal />
    </CartProvider>
  );
}
