import Link from "next/link";
import { getSessionDisplayName } from "@/lib/auth/session-display-name";
import { createClient } from "@/lib/supabase/server";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { formatInr } from "@/lib/format-currency";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = createClient();
  const access = await getUserAccess();

  const roleLabel = access.isSuperAdmin
    ? "super_admin"
    : access.membership?.role ?? "unassigned";
  const roleKey = (access.membership?.role ?? "pet_owner") as
    | "super_admin"
    | "clinic_admin"
    | "branch_admin"
    | "doctor"
    | "receptionist"
    | "lab_technician"
    | "pharmacist"
    | "pet_owner";
  const clinicLabel = access.membership?.clinic_id ?? "-";
  const clinicId = access.membership?.clinic_id ?? null;
  const navGroups = getRoleNavGroups(roleKey, access.isSuperAdmin);
  const flatNavItems = navGroups.flatMap((g) => g.items);

  let appointmentsTodayText = "";
  let activePatientsText = "";
  let pendingPrescriptionsText = "";
  let monthlyRevenueText = "";
  let nextConsultationTitle = "";
  let nextConsultationSubtitle = "";

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const metricsPromise = clinicId
    ? Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .gte("starts_at", `${today}T00:00:00`)
          .lt("starts_at", `${today}T23:59:59`),
        supabase
          .from("pets")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("is_active", true),
        supabase
          .from("prescriptions")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .gte("issued_at", `${today}T00:00:00`)
          .lt("issued_at", `${today}T23:59:59`),
        supabase
          .from("orders")
          .select("grand_total")
          .eq("clinic_id", clinicId)
          .eq("status", "paid")
          .gte("placed_at", monthStart.toISOString()),
        supabase
          .from("appointments")
          .select("starts_at, appointment_type, pets(name)")
          .eq("clinic_id", clinicId)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ])
    : Promise.resolve(null);

  const [displayName, metrics] = await Promise.all([
    getSessionDisplayName(supabase, access, access.email),
    metricsPromise,
  ]);

  if (metrics) {
    const [
      appointmentsTodayRes,
      activePatientsRes,
      pendingPrescriptionsRes,
      monthlyRevenueRes,
      nextAppointmentRes,
    ] = metrics;

    appointmentsTodayText =
      appointmentsTodayRes.count !== null && appointmentsTodayRes.count !== undefined
        ? String(appointmentsTodayRes.count)
        : "";
    activePatientsText =
      activePatientsRes.count !== null && activePatientsRes.count !== undefined
        ? String(activePatientsRes.count)
        : "";
    pendingPrescriptionsText =
      pendingPrescriptionsRes.count !== null && pendingPrescriptionsRes.count !== undefined
        ? String(pendingPrescriptionsRes.count)
        : "";

    const monthlyRevenue = (monthlyRevenueRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.grand_total ?? 0),
      0,
    );
    monthlyRevenueText = monthlyRevenue > 0 ? formatInr(monthlyRevenue) : "";

    if (nextAppointmentRes.data) {
      const nextPet = nextAppointmentRes.data.pets as { name?: string } | null;
      nextConsultationTitle = nextPet?.name ?? "";
      const startsAt = new Date(nextAppointmentRes.data.starts_at);
      if (!Number.isNaN(startsAt.getTime())) {
        nextConsultationSubtitle = `${nextAppointmentRes.data.appointment_type ?? ""} • ${startsAt.toLocaleString()}`;
      }
    }
  }

  async function signOut() {
    "use server";
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell
      title="Welcome Back"
      subtitle={`${displayName} · Role: ${roleLabel} · Clinic: ${clinicLabel}`}
      activeHref="/dashboard"
      navGroups={navGroups}
      topRight={
        <form action={signOut}>
          <button className="btn-primary btn-compact" type="submit">
            Sign out
          </button>
        </form>
      }
    >
      <div className="space-y-3">
        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <article className="card-soft">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Appointments today</p>
            <p className="mt-1 font-headline text-2xl font-extrabold tabular-nums text-slate-900">{appointmentsTodayText}</p>
          </article>
          <article className="card-soft">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Active patients</p>
            <p className="mt-1 font-headline text-2xl font-extrabold tabular-nums text-slate-900">{activePatientsText}</p>
          </article>
          <article className="card-soft">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Rx today</p>
            <p className="mt-1 font-headline text-2xl font-extrabold tabular-nums text-slate-900">{pendingPrescriptionsText}</p>
          </article>
          <article className="card-soft">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Revenue (month)</p>
            <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-slate-900">{monthlyRevenueText}</p>
          </article>
        </section>

        <section className="grid gap-2 lg:grid-cols-3">
          <article className="rounded-md border border-primary/30 bg-gradient-to-br from-primary-container to-primary p-3 text-white lg:col-span-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-primary-fixed">Next consultation</p>
            <h2 className="mt-1 font-headline text-lg font-extrabold leading-tight">{nextConsultationTitle}</h2>
            <p className="mt-0.5 text-[11px] text-white/90">{nextConsultationSubtitle}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Link className="rounded border border-white/25 bg-white/15 px-2 py-1 text-[11px] font-semibold hover:bg-white/25" href="/appointments/calendar">
                Calendar
              </Link>
              <Link className="rounded border border-white/25 bg-white/15 px-2 py-1 text-[11px] font-semibold hover:bg-white/25" href="/appointments">
                Queue
              </Link>
            </div>
          </article>

          <article className="card-soft">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Quick access</p>
            <div className="mt-1.5 space-y-1 text-[11px]">
              {flatNavItems
                .filter((item) => item.href !== "/dashboard")
                .slice(0, 6)
                .map((item) => (
                  <Link
                    key={item.href}
                    className="block rounded border border-slate-200/90 bg-slate-50 px-2 py-1 font-medium text-slate-800 hover:bg-white"
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
              {(access.membership || access.isSuperAdmin) && !flatNavItems.some((n) => n.href === "/invite-qrs") ? (
                <Link className="block rounded border border-slate-200/90 bg-slate-50 px-2 py-1 font-medium text-slate-800 hover:bg-white" href="/invite-qrs">
                  Invite QR management
                </Link>
              ) : null}
              {access.isSuperAdmin && !flatNavItems.some((n) => n.href === "/super-admin") ? (
                <Link className="block rounded border border-slate-200/90 bg-slate-50 px-2 py-1 font-medium text-slate-800 hover:bg-white" href="/super-admin">
                  Super admin control
                </Link>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
