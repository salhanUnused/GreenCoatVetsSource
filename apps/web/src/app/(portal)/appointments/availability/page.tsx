import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups, type AppRole } from "@/lib/auth/permissions";
import { AppShell } from "@/components/web/app-shell";
import { createClient } from "@/lib/supabase/server";
import { deleteDoctorAvailabilityRule, saveDoctorAvailabilityRule } from "./actions";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function DoctorAvailabilityPage() {
  const membership = await getActiveMembership();
  const access = await getUserAccess();
  const supabase = createClient();

  const [{ data: doctors }, { data: branches }, { data: rules }] = await Promise.all([
    supabase
      .from("staff_profiles")
      .select("id, full_name, branch_id")
      .eq("clinic_id", membership.clinic_id)
      .in("role", ["doctor", "junior_doctor", "senior_doctor"])
      .eq("is_active", true)
      .order("full_name"),
    supabase.from("branches").select("id, name").eq("clinic_id", membership.clinic_id).order("name"),
    supabase
      .from("doctor_availability_rules")
      .select("id, doctor_id, branch_id, day_of_week, start_time, end_time, slot_minutes, staff_profiles(full_name)")
      .eq("clinic_id", membership.clinic_id)
      .eq("is_active", true)
      .order("day_of_week"),
  ]);

  const nav = getRoleNavGroups(membership.role as AppRole, access.isSuperAdmin);

  return (
    <AppShell navGroups={nav} title="Doctor availability">
      <p className="mb-6 max-w-2xl text-sm text-on-surface-variant">
        Weekly schedules power public booking slots on the clinic website. If no rules exist, Mon–Sat 9:00–17:00 (30 min slots) is used.
      </p>

      <form action={saveDoctorAvailabilityRule} className="mb-10 grid max-w-3xl gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 sm:grid-cols-2">
        <h2 className="sm:col-span-2 font-headline text-lg font-bold text-on-surface">Add weekly rule</h2>
        <label className="text-sm">
          Doctor
          <select name="doctor_id" required className="mt-1 w-full rounded-lg border px-3 py-2">
            <option value="">Select</option>
            {(doctors ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Branch (optional)
          <select name="branch_id" className="mt-1 w-full rounded-lg border px-3 py-2">
            <option value="">All branches</option>
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Day
          <select name="day_of_week" required className="mt-1 w-full rounded-lg border px-3 py-2">
            {days.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Slot length (minutes)
          <input name="slot_minutes" type="number" min={10} max={120} defaultValue={30} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="text-sm">
          Start
          <input name="start_time" type="time" defaultValue="09:00" required className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="text-sm">
          End
          <input name="end_time" type="time" defaultValue="17:00" required className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <button type="submit" className="sm:col-span-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-on-primary">
          Save rule
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-container-low text-on-surface-variant">
            <tr>
              <th className="px-4 py-3">Doctor</th>
              <th className="px-4 py-3">Day</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Slot</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(rules ?? []).map((r) => {
              const sp = r.staff_profiles as { full_name?: string } | { full_name?: string }[] | null;
              const name = Array.isArray(sp) ? sp[0]?.full_name : sp?.full_name;
              return (
                <tr key={r.id} className="border-t border-outline-variant/20">
                  <td className="px-4 py-3">{name ?? "—"}</td>
                  <td className="px-4 py-3">{days[r.day_of_week] ?? r.day_of_week}</td>
                  <td className="px-4 py-3">
                    {String(r.start_time).slice(0, 5)} – {String(r.end_time).slice(0, 5)}
                  </td>
                  <td className="px-4 py-3">{r.slot_minutes} min</td>
                  <td className="px-4 py-3">
                    <form action={deleteDoctorAvailabilityRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="text-sm font-semibold text-red-700 hover:underline">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(rules ?? []).length === 0 ? <p className="px-4 py-6 text-sm text-on-surface-variant">No rules yet.</p> : null}
      </div>
    </AppShell>
  );
}
