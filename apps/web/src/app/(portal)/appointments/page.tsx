import Link from "next/link";
import { redirect } from "next/navigation";
import {
  confirmDeleteWebsiteAppointmentsAction,
  confirmDeleteWebsiteOwnerPetAction,
  createAppointment,
  sendWebsiteAppointmentsDeleteCodeAction,
  sendWebsiteOwnerPetDeleteCodeAction,
  rescheduleOnlineConsult,
  updateAppointmentStatus,
} from "./actions";
import { createVisitFromAppointment } from "@/app/(portal)/visits/actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { AppointmentDateTimeField } from "@/components/booking/appointment-datetime-field";
import { AppointmentsAdminDangerZone } from "@/components/booking/appointments-admin-danger-zone";
import { SubmitButton } from "@/components/web/submit-button";

type SearchParams = {
  date?: string;
  status?: string;
  branch?: string;
  type?: string;
  source?: string;
  purge_code_sent?: string;
  purge_target_count?: string;
  purged?: string;
  purged_count?: string;
  purge_error?: string;
  owner_pet_purge_code_sent?: string;
  owner_pet_purge_owner_count?: string;
  owner_pet_purge_pet_count?: string;
  owner_pet_purged?: string;
  owner_pet_purged_owner_count?: string;
  owner_pet_purged_pet_count?: string;
  owner_pet_purge_error?: string;
};

const typeOptions = [
  "consultation",
  "vaccination",
  "surgery",
  "grooming",
  "emergency",
] as const;

const statusOptions = [
  "scheduled",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const;

const sourceOptions = [
  { value: "manual", label: "Manual / clinic-created" },
  { value: "owner_portal", label: "Website owner portal" },
  { value: "website_guest", label: "Website guest booking" },
] as const;

function pickName(row: unknown, key: "full_name" | "name"): string {
  if (!row) return "-";
  if (Array.isArray(row)) {
    const first = row[0] as Record<string, string> | undefined;
    return first?.[key] ?? "-";
  }
  return (row as Record<string, string>)[key] ?? "-";
}

function sourceLabel(source: string | null | undefined): string {
  if (!source) return "Manual";
  if (source === "clinic_portal") return "Clinic portal";
  if (source === "owner_portal") return "Owner portal";
  if (source === "website_guest") return "Website guest";
  return source.replace(/_/g, " ");
}

function formatAppointmentDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const date = (searchParams.date ?? "").trim();
  const status = (searchParams.status ?? "").trim();
  const branch = (searchParams.branch ?? "").trim();
  const type = (searchParams.type ?? "").trim();
  const source = (searchParams.source ?? "").trim();
  const purgeCodeSent = searchParams.purge_code_sent === "1" || searchParams.purge_code_sent === "true";
  const purged = searchParams.purged === "1" || searchParams.purged === "true";
  const purgeTargetCount = Number(searchParams.purge_target_count ?? "0") || 0;
  const purgedCount = Number(searchParams.purged_count ?? "0") || 0;
  const purgeError = typeof searchParams.purge_error === "string" ? searchParams.purge_error : null;
  const ownerPetPurgeCodeSent = searchParams.owner_pet_purge_code_sent === "1" || searchParams.owner_pet_purge_code_sent === "true";
  const ownerPetPurgeOwnerCount = Number(searchParams.owner_pet_purge_owner_count ?? "0") || 0;
  const ownerPetPurgePetCount = Number(searchParams.owner_pet_purge_pet_count ?? "0") || 0;
  const ownerPetPurged = searchParams.owner_pet_purged === "1" || searchParams.owner_pet_purged === "true";
  const ownerPetPurgedOwnerCount = Number(searchParams.owner_pet_purged_owner_count ?? "0") || 0;
  const ownerPetPurgedPetCount = Number(searchParams.owner_pet_purged_pet_count ?? "0") || 0;
  const ownerPetPurgeError = typeof searchParams.owner_pet_purge_error === "string" ? searchParams.owner_pet_purge_error : null;

  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  if (!access.isSuperAdmin && !["clinic_admin", "branch_admin", "doctor", "receptionist"].includes(role)) {
    redirect("/dashboard");
  }

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canManageWebsiteDeletes = access.isSuperAdmin || role === "clinic_admin";

  const [branchesRes, doctorsRes, ownersRes, petsRes, websiteBookingCountRes, websiteOwnerPetPurgeStatsRes] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name")
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("staff_profiles")
      .select("id, full_name")
      .eq("clinic_id", clinic_id)
      .in("role", ["doctor", "junior_doctor", "senior_doctor"])
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("owners")
      .select("id, full_name")
      .eq("clinic_id", clinic_id)
      .order("full_name", { ascending: true })
      .limit(300),
    supabase
      .from("pets")
      .select("id, name, owner_id")
      .eq("clinic_id", clinic_id)
      .order("name", { ascending: true })
      .limit(300),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .in("booking_source", ["website_guest", "owner_portal"]),
    canManageWebsiteDeletes
      ? supabase.rpc("get_website_owner_pet_purge_stats", {
          p_clinic_id: clinic_id,
          p_cutoff: new Date().toISOString(),
          p_excluded_email: user?.email?.trim().toLowerCase() ?? null,
        })
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (branchesRes.error) throw new Error(branchesRes.error.message);
  if (doctorsRes.error) throw new Error(doctorsRes.error.message);
  if (ownersRes.error) throw new Error(ownersRes.error.message);
  if (petsRes.error) throw new Error(petsRes.error.message);
  if (websiteBookingCountRes.error) throw new Error(websiteBookingCountRes.error.message);
  if (websiteOwnerPetPurgeStatsRes.error) throw new Error(websiteOwnerPetPurgeStatsRes.error.message);

  const branchOptions = branchesRes.data ?? [];
  const hasBranches = branchOptions.length > 0;
  const websiteBookingCount = websiteBookingCountRes.count ?? 0;
  const ownerPetPurgeRow = Array.isArray(websiteOwnerPetPurgeStatsRes.data)
    ? websiteOwnerPetPurgeStatsRes.data[0]
    : websiteOwnerPetPurgeStatsRes.data;
  const websiteOwnerPurgeCount = Number((ownerPetPurgeRow as { owner_count?: number | string | null } | null)?.owner_count ?? 0) || 0;
  const websitePetPurgeCount = Number((ownerPetPurgeRow as { pet_count?: number | string | null } | null)?.pet_count ?? 0) || 0;

  let query = supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, meet_link, appointment_type, status, notes, booking_source, branch_id, owners(full_name), pets(name), branches(name), staff_profiles(full_name)"
    )
    .eq("clinic_id", clinic_id)
    .order("starts_at", { ascending: false })
    .limit(200);

  if (status && statusOptions.includes(status as (typeof statusOptions)[number])) {
    query = query.eq("status", status);
  }
  if (branch) {
    query = query.eq("branch_id", branch);
  }
  if (type && typeOptions.includes(type as (typeof typeOptions)[number])) {
    query = query.eq("appointment_type", type);
  }
  if (source === "manual") {
    query = query.or("booking_source.is.null,booking_source.eq.clinic_portal");
  } else if (source && sourceOptions.some((option) => option.value === source)) {
    query = query.eq("booking_source", source);
  }
  if (date) {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59.999`);
    query = query.gte("starts_at", dayStart.toISOString()).lte("starts_at", dayEnd.toISOString());
  }

  const { data: appointments, error: appointmentsError } = await query;
  if (appointmentsError) throw new Error(appointmentsError.message);

  const ownerMap = new Map((ownersRes.data ?? []).map((o) => [o.id, o.full_name]));

  async function startConsultation(formData: FormData) {
    "use server";
    const visitId = await createVisitFromAppointment(formData);
    redirect(`/visits/${visitId}`);
  }

  return (
    <AppShell
      title="Appointments"
      subtitle="List view — pair with the calendar board for scheduling."
      activeHref="/appointments"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary text-sm" href="/api/exports/appointments">
            Export appointments (Excel CSV)
          </a>
          <Link className="btn-secondary text-sm" href="/appointments/calendar">
            Calendar board
          </Link>
          <Link className="btn-primary text-sm" href="/dashboard">
            Dashboard
          </Link>
        </div>
      }
    >
      {purgeError ? (
        <section className="card-soft mb-4 border border-red-200 bg-red-50 text-red-900">
          <p className="font-semibold">Website appointment delete failed</p>
          <p className="mt-1 text-sm">{purgeError}</p>
        </section>
      ) : null}
      {ownerPetPurgeError ? (
        <section className="card-soft mb-4 border border-red-200 bg-red-50 text-red-900">
          <p className="font-semibold">Website owner and patient cleanup failed</p>
          <p className="mt-1 text-sm">{ownerPetPurgeError}</p>
        </section>
      ) : null}
      {purgeCodeSent ? (
        <section className="card-soft mb-4 border border-emerald-200 bg-emerald-50 text-emerald-950">
          <p className="font-semibold">Verification code sent</p>
          <p className="mt-1 text-sm">
            We emailed a code to <strong>{user?.email ?? "your account email"}</strong> for deleting the existing website-booked appointments in this
            clinic.
            {purgeTargetCount > 0 ? ` This code currently covers ${purgeTargetCount} appointment${purgeTargetCount === 1 ? "" : "s"}.` : ""}
          </p>
        </section>
      ) : null}
      {ownerPetPurgeCodeSent ? (
        <section className="card-soft mb-4 border border-emerald-200 bg-emerald-50 text-emerald-950">
          <p className="font-semibold">Website owner and patient cleanup code sent</p>
          <p className="mt-1 text-sm">
            We emailed a code to <strong>{user?.email ?? "your account email"}</strong> for deleting eligible website-created owners and patients in
            this clinic.
            {ownerPetPurgeOwnerCount > 0 || ownerPetPurgePetCount > 0
              ? ` This code currently covers ${ownerPetPurgeOwnerCount} owner${ownerPetPurgeOwnerCount === 1 ? "" : "s"} and ${ownerPetPurgePetCount} patient${ownerPetPurgePetCount === 1 ? "" : "s"}.`
              : ""}
          </p>
        </section>
      ) : null}
      {purged ? (
        <section className="card-soft mb-4 border border-emerald-200 bg-emerald-50 text-emerald-950">
          <p className="font-semibold">Website-booked appointments deleted</p>
          <p className="mt-1 text-sm">
            Removed {purgedCount} website-booked appointment{purgedCount === 1 ? "" : "s"} from this clinic.
          </p>
        </section>
      ) : null}
      {ownerPetPurged ? (
        <section className="card-soft mb-4 border border-emerald-200 bg-emerald-50 text-emerald-950">
          <p className="font-semibold">Website owners and patients deleted</p>
          <p className="mt-1 text-sm">
            Removed {ownerPetPurgedOwnerCount} website-created owner{ownerPetPurgedOwnerCount === 1 ? "" : "s"} and {ownerPetPurgedPetCount} patient
            {ownerPetPurgedPetCount === 1 ? "" : "s"} from this clinic.
          </p>
        </section>
      ) : null}

      <section className="card-soft">
        <h2 className="font-headline text-lg font-bold">Filters</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6" method="get">
          <input className="input-soft" type="date" name="date" defaultValue={date} />
          <select className="input-soft" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="input-soft" name="branch" defaultValue={branch}>
            <option value="">All branches</option>
            {branchOptions.map((branchOption) => (
              <option key={branchOption.id} value={branchOption.id}>
                {branchOption.name}
              </option>
            ))}
          </select>
          <select className="input-soft" name="type" defaultValue={type}>
            <option value="">All appointment types</option>
            {typeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select className="input-soft" name="source" defaultValue={source}>
            <option value="">All sources</option>
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button className="btn-primary" type="submit">
            Apply
          </button>
        </form>
        <div className="mt-3">
          <Link className="text-sm font-semibold text-primary hover:underline" href="/appointments">
            Clear filters
          </Link>
        </div>
      </section>

      {canManageWebsiteDeletes ? (
        <AppointmentsAdminDangerZone
          userEmail={user?.email ?? "your admin email"}
          websiteBookingCount={websiteBookingCount}
          websiteOwnerPurgeCount={websiteOwnerPurgeCount}
          websitePetPurgeCount={websitePetPurgeCount}
          appointmentsCleanup={
            <div className="grid gap-4 lg:grid-cols-2">
              <form action={sendWebsiteAppointmentsDeleteCodeAction} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Step 1: Email a verification code</p>
                <p className="mt-1 text-sm text-slate-600">Request a fresh 6-digit code before the delete step below.</p>
                <SubmitButton className="btn-secondary mt-4" pendingLabel="Sending code…">
                  Send delete code
                </SubmitButton>
              </form>
              <form action={confirmDeleteWebsiteAppointmentsAction} className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                <p className="text-sm font-semibold text-red-950">Step 2: Confirm deletion</p>
                <p className="mt-1 text-sm text-red-900/80">
                  Type <span className="rounded bg-white px-1 font-mono">delete</span> and enter the emailed code to remove those website-booked rows.
                </p>
                <div className="mt-4 grid gap-3">
                  <input
                    className="input-soft bg-white"
                    name="verification_code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    placeholder="6-digit code"
                    required
                  />
                  <input
                    className="input-soft bg-white"
                    name="confirm_delete_text"
                    placeholder='Type "delete"'
                    required
                  />
                </div>
                <SubmitButton className="btn-secondary mt-4 border-red-300 bg-red-600 text-white" pendingLabel="Deleting…">
                  Delete website-booked appointments
                </SubmitButton>
              </form>
            </div>
          }
          ownersPetsCleanup={
            <div className="grid gap-4 lg:grid-cols-2">
              <form action={sendWebsiteOwnerPetDeleteCodeAction} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Step 1: Email a verification code</p>
                <p className="mt-1 text-sm text-slate-600">Request a fresh 6-digit code before the delete step below.</p>
                <SubmitButton className="btn-secondary mt-4" pendingLabel="Sending code…">
                  Send owner/patient delete code
                </SubmitButton>
              </form>
              <form action={confirmDeleteWebsiteOwnerPetAction} className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                <p className="text-sm font-semibold text-red-950">Step 2: Confirm deletion</p>
                <p className="mt-1 text-sm text-red-900/80">
                  Type <span className="rounded bg-white px-1 font-mono">delete</span> and enter the emailed code to remove those website-created owner
                  and patient rows.
                </p>
                <div className="mt-4 grid gap-3">
                  <input
                    className="input-soft bg-white"
                    name="verification_code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    placeholder="6-digit code"
                    required
                  />
                  <input
                    className="input-soft bg-white"
                    name="confirm_delete_text"
                    placeholder='Type "delete"'
                    required
                  />
                </div>
                <SubmitButton className="btn-secondary mt-4 border-red-300 bg-red-600 text-white" pendingLabel="Deleting…">
                  Delete website-created owners and patients
                </SubmitButton>
              </form>
            </div>
          }
        />
      ) : null}

      <section className="mt-6 card-soft" id="create-appointment">
        <h2 className="font-headline text-lg font-bold">Create appointment</h2>
        {!hasBranches ? (
          <div className="mt-3 rounded-xl border border-primary/25 bg-primary-container/15 p-4 text-sm text-on-surface">
            <p className="font-semibold text-on-surface">No branches for this clinic yet</p>
            <p className="mt-1 text-on-surface-variant">
              Appointments need a branch. Clinic admins can add locations under{" "}
              <Link className="font-bold text-primary underline" href="/branches">
                Branches
              </Link>
              . New clinics created by a super admin automatically get a &quot;Main&quot; branch after the latest migration.
            </p>
          </div>
        ) : null}
        <form action={createAppointment} className="mt-3 grid gap-3 md:grid-cols-2">
          <select className="input-soft" name="branch_id" required disabled={!hasBranches}>
            <option value="">{hasBranches ? "Select branch" : "Add a branch first"}</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select className="input-soft" name="doctor_id">
            <option value="">Assign doctor (optional)</option>
            {doctorsRes.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
          <select className="input-soft" name="owner_id" required>
            <option value="">Select owner</option>
            {ownersRes.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name}
              </option>
            ))}
          </select>
          <select className="input-soft" name="pet_id" required>
            <option value="">Select pet</option>
            {petsRes.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({ownerMap.get(p.owner_id) ?? "Unknown owner"})
              </option>
            ))}
          </select>
          <select className="input-soft" name="appointment_type" required>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <AppointmentDateTimeField className="input-soft" />
          <textarea
            className="input-soft md:col-span-2"
            name="notes"
            placeholder="Notes (optional)"
            rows={2}
          />
          <SubmitButton className="btn-primary md:col-span-2" pendingLabel="Saving appointment…" disabled={!hasBranches}>
            Save appointment
          </SubmitButton>
        </form>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl bg-surface-container-low p-4">
        <h2 className="mb-3 font-headline text-lg font-bold">Appointments (newest first)</h2>
        <div className="overflow-x-auto rounded-xl bg-surface-container-lowest p-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-on-surface-variant">
                <th className="px-3 py-3">Time</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Pet</th>
                <th className="px-3 py-3">Branch</th>
                <th className="px-3 py-3">Doctor</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
                <th className="px-3 py-3">Consultation</th>
              </tr>
            </thead>
            <tbody>
              {appointments?.map((appt) => (
                <tr className="border-t border-outline-variant/20 odd:bg-surface even:bg-surface-container-low" key={appt.id} id={`appt-${appt.id}`}>
                  <td className="px-3 py-3">{formatAppointmentDateTime(appt.starts_at)}</td>
                  <td className="px-3 py-3">{appt.appointment_type}</td>
                  <td className="px-3 py-3">{pickName(appt.owners, "full_name")}</td>
                  <td className="px-3 py-3">{pickName(appt.pets, "name")}</td>
                  <td className="px-3 py-3">{pickName(appt.branches, "name")}</td>
                  <td className="px-3 py-3">{pickName(appt.staff_profiles, "full_name")}</td>
                  <td className="px-3 py-3">{sourceLabel(appt.booking_source as string | null | undefined)}</td>
                  <td className="px-3 py-3">{appt.status}</td>
                  <td className="px-3 py-3">
                    <form action={updateAppointmentStatus} className="flex flex-wrap gap-2">
                      <input type="hidden" name="appointment_id" value={appt.id} />
                      <select className="input-soft py-1.5 text-xs" name="status" defaultValue={appt.status}>
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <SubmitButton className="btn-secondary py-1.5 text-xs" pendingLabel="…">
                        Update
                      </SubmitButton>
                    </form>
                  </td>
                  <td className="px-3 py-3">
                    {appt.appointment_type === "online_consult" ? (
                      <div className="space-y-2">
                        <a
                          href={`/api/online-consult/redirect/${appt.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-primary underline"
                        >
                          Join video (staff)
                        </a>
                        {appt.meet_link ? (
                          <>
                            <p className="text-[10px] text-on-surface-variant break-all">Owner link: {appt.meet_link as string}</p>
                            <p className="text-[10px] text-on-surface-variant">
                              Doctor direct link is available from &quot;Join video (staff)&quot; URL.
                            </p>
                          </>
                        ) : null}
                        <form action={rescheduleOnlineConsult} className="flex flex-col gap-1">
                          <input type="hidden" name="appointment_id" value={appt.id} />
                          <AppointmentDateTimeField name="starts_at" className="input-soft py-1.5 text-xs" />
                          <SubmitButton className="btn-secondary py-1.5 text-xs" pendingLabel="…">
                            Reschedule online
                          </SubmitButton>
                        </form>
                      </div>
                    ) : (
                      <form action={startConsultation}>
                        <input type="hidden" name="appointment_id" value={appt.id} />
                        <SubmitButton className="btn-primary py-1.5 text-xs" pendingLabel="…">
                          Open visit
                        </SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!appointments?.length ? (
            <p className="px-3 py-4 text-sm text-on-surface-variant">No appointments found.</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
