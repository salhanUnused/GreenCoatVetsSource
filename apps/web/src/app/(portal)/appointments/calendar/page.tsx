import Link from "next/link";
import { redirect } from "next/navigation";
import { AppointmentCalendarBoard } from "@/components/appointments/appointment-calendar-board";
import type { CalendarAppointmentRow } from "@/components/appointments/appointment-calendar-board";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import {
  CalendarView,
  parseLocalDateKey,
  rangeForView,
  resolveCalendarTimeZone,
  toLocalDateKey,
} from "@/lib/appointments/calendar-utils";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";

type SearchParams = {
  date?: string;
  view?: string;
  doctor_id?: string;
  q?: string;
};

function normalizeView(v: string | undefined): CalendarView {
  if (v === "day" || v === "week" || v === "month") return v;
  return "week";
}

export default async function AppointmentCalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as
    | "super_admin"
    | "clinic_admin"
    | "branch_admin"
    | "doctor"
    | "receptionist"
    | "lab_technician"
    | "pharmacist"
    | "pet_owner";
  if (!access.isSuperAdmin && !["clinic_admin", "branch_admin", "doctor", "receptionist"].includes(role)) {
    redirect("/dashboard");
  }

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  const { data: clinicRow } = await supabase.from("clinics").select("timezone").eq("id", clinic_id).maybeSingle();

  const view = normalizeView(searchParams.view);
  const anchorDateKey =
    parseLocalDateKey(searchParams.date ?? "") != null
      ? (searchParams.date ?? "").trim()
      : toLocalDateKey(new Date());
  const anchor = parseLocalDateKey(anchorDateKey) ?? new Date();
  const selectedDoctorId = (searchParams.doctor_id ?? "").trim();
  const q = (searchParams.q ?? "").trim();

  const { startIso, endIso } = rangeForView(view, anchor);

  const [{ data: doctors, error: doctorsError }, { data: raw, error: appointmentsError }] = await Promise.all([
    supabase
      .from("staff_profiles")
      .select("id, full_name")
      .eq("clinic_id", clinic_id)
      .in("role", ["doctor", "junior_doctor", "senior_doctor"])
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    (() => {
      let query = supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, appointment_type, status, pets(name), owners(full_name), staff_profiles(full_name), branches(name)"
        )
        .eq("clinic_id", clinic_id)
        .gte("starts_at", startIso)
        .lte("starts_at", endIso)
        .order("starts_at", { ascending: true })
        .limit(500);
      if (selectedDoctorId) {
        query = query.eq("doctor_id", selectedDoctorId);
      }
      return query;
    })(),
  ]);

  if (doctorsError) throw new Error(doctorsError.message);
  if (appointmentsError) throw new Error(appointmentsError.message);

  const appointments: CalendarAppointmentRow[] = (raw ?? []).map((row) => {
    const pets = row.pets as { name?: string } | { name?: string }[] | null;
    const owners = row.owners as { full_name?: string } | { full_name?: string }[] | null;
    const staff = row.staff_profiles as { full_name?: string } | { full_name?: string }[] | null;
    const branches = row.branches as { name?: string } | { name?: string }[] | null;
    const petName = Array.isArray(pets) ? pets[0]?.name : pets?.name;
    const ownerName = Array.isArray(owners) ? owners[0]?.full_name : owners?.full_name;
    const doctorName = Array.isArray(staff) ? staff[0]?.full_name : staff?.full_name;
    const branchName = Array.isArray(branches) ? branches[0]?.name : branches?.name;
    return {
      id: row.id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      appointment_type: row.appointment_type,
      status: row.status,
      pet_name: petName ?? null,
      owner_name: ownerName ?? null,
      doctor_name: doctorName ?? null,
      branch_name: branchName ?? null,
    };
  });

  return (
    <AppShell
      title="Appointment schedule"
      subtitle="Live calendar board — week, day, and month views use your clinic data."
      activeHref="/appointments/calendar"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary text-sm" href="/appointments">
            List view
          </Link>
          <Link className="btn-primary text-sm" href="/dashboard">
            Dashboard
          </Link>
        </div>
      }
    >
      {/* Top bar — inspiration: search + filters */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl bg-surface-container-low px-4 py-3 md:flex-row md:items-center md:justify-between">
        <form className="flex w-full max-w-md items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-1.5 md:max-w-lg" method="get">
          <input type="hidden" name="date" value={anchorDateKey} />
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="doctor_id" value={selectedDoctorId} />
          <span className="material-symbols-outlined text-on-surface-variant text-lg">search</span>
          <input
            className="w-full border-none bg-transparent text-sm outline-none ring-0 placeholder:text-on-surface-variant/60"
            name="q"
            defaultValue={q}
            placeholder="Search patients, owners, or staff…"
            type="search"
          />
          <button type="submit" className="text-xs font-semibold text-primary">
            Find
          </button>
        </form>

        <form className="flex flex-wrap items-center gap-2" method="get">
          <input type="hidden" name="date" value={anchorDateKey} />
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="q" value={q} />
          <label className="text-xs font-medium text-on-surface-variant">Doctor</label>
          <select className="input-soft min-w-[160px] py-2 text-sm" name="doctor_id" defaultValue={selectedDoctorId}>
            <option value="">All doctors</option>
            {doctors?.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.full_name}
              </option>
            ))}
          </select>
          <button className="btn-primary py-2 text-sm" type="submit">
            Apply
          </button>
        </form>
      </div>

      <AppointmentCalendarBoard
        anchorDateKey={anchorDateKey}
        view={view}
        doctorId={selectedDoctorId}
        searchQ={q}
        timeZone={resolveCalendarTimeZone(clinicRow?.timezone)}
        doctors={(doctors ?? []).map((d) => ({ id: d.id, full_name: d.full_name }))}
        appointments={appointments}
      />
    </AppShell>
  );
}
