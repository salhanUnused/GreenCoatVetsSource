import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listAppUsersForSuperAdmin,
  listClinicsMinimalForSuperAdmin,
  superAdminAssignUserToClinicAction,
  superAdminDeactivateUserEverywhereAction,
  superAdminDeleteUserFromDatabaseAction,
  superAdminSendPasswordResetAction,
} from "../actions";
import { AppShell } from "@/components/web/app-shell";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";

const ASSIGN_ROLES = [
  { value: "clinic_admin", label: "Clinic admin" },
  { value: "branch_admin", label: "Branch admin" },
  { value: "doctor", label: "Doctor" },
  { value: "junior_doctor", label: "Junior doctor" },
  { value: "senior_doctor", label: "Senior doctor" },
  { value: "manager", label: "Manager" },
  { value: "junior", label: "Junior" },
  { value: "receptionist", label: "Receptionist" },
  { value: "lab_technician", label: "Lab technician" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "marketing_editor", label: "Website editor (marketing admin)" },
  { value: "pet_owner", label: "Pet owner" },
] as const;

export default async function SuperAdminUsersPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const access = await getUserAccess();
  if (!access.isSuperAdmin) {
    redirect("/dashboard");
  }

  const navGroups = getRoleNavGroups("clinic_admin", true);
  const [users, clinics] = await Promise.all([listAppUsersForSuperAdmin(), listClinicsMinimalForSuperAdmin()]);
  const saved = searchParams.saved === "1" || searchParams.saved === "true";
  const deactivated = searchParams.deactivated === "1" || searchParams.deactivated === "true";
  const deleted = searchParams.deleted === "1" || searchParams.deleted === "true";
  const resetSent = searchParams.reset_sent === "1" || searchParams.reset_sent === "true";
  const errorMessage = typeof searchParams.error === "string" ? searchParams.error : null;
  const warningMessage = typeof searchParams.warning === "string" ? searchParams.warning : null;

  return (
    <AppShell
      title="Users & roles"
      subtitle="Create accounts, assign roles to any clinic, or deactivate all clinic access for a user."
      activeHref="/super-admin/users"
      navGroups={navGroups}
      topRight={
        <Link className="btn-secondary btn-compact" href="/super-admin">
          Platform control
        </Link>
      }
    >
      {errorMessage ? (
        <section className="card-soft mb-3 border border-red-200 bg-red-50 text-red-900">
          <p className="font-semibold">Could not complete that user action</p>
          <p className="mt-1 text-sm">{errorMessage}</p>
        </section>
      ) : null}
      {saved ? (
        <section className="card-soft mb-3 border border-emerald-200 bg-emerald-50 text-emerald-950">
          <p className="font-semibold">User assigned</p>
          <p className="mt-1 text-sm">The account was created or linked successfully.</p>
        </section>
      ) : null}
      {warningMessage ? (
        <section className="card-soft mb-3 border border-amber-200 bg-amber-50 text-amber-950">
          <p className="font-semibold">Welcome email not sent</p>
          <p className="mt-1 text-sm">{warningMessage}</p>
        </section>
      ) : null}
      {deactivated ? (
        <section className="card-soft mb-3 border border-emerald-200 bg-emerald-50 text-emerald-950">
          <p className="font-semibold">User deactivated</p>
          <p className="mt-1 text-sm">All clinic access for that user has been removed.</p>
        </section>
      ) : null}
      {deleted ? (
        <section className="card-soft mb-3 border border-emerald-200 bg-emerald-50 text-emerald-950">
          <p className="font-semibold">User deleted from database</p>
          <p className="mt-1 text-sm">The selected platform-table records were removed successfully.</p>
        </section>
      ) : null}
      {resetSent ? (
        <section className="card-soft mb-3 border border-emerald-200 bg-emerald-50 text-emerald-950">
          <p className="font-semibold">Password reset email sent</p>
          <p className="mt-1 text-sm">The user can follow the link in their email to set a new portal password.</p>
        </section>
      ) : null}
      <section className="card-soft mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Assign role (any clinic)</h2>
        <p className="mt-1 text-[11px] text-slate-600">
          Existing users can be assigned immediately. If the email is new, add a temporary password below — the account is created, assigned, and emailed login details.
          Choose <strong>Website editor</strong> for users who should sign in at{" "}
          <span className="font-mono text-[10px]">/admin/login</span> on the public website (blog, settings, reviews). They must set a new password on first login.
        </p>
        <form action={superAdminAssignUserToClinicAction} className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-0.5 text-[11px] md:col-span-2 lg:col-span-3">
            <span className="font-semibold text-slate-700">Clinic</span>
            <select
              name="clinic_id"
              required
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]"
              defaultValue={clinics[0]?.id ?? ""}
            >
              {clinics.length ? (
              clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            ) : (
              <option value="">No active clinics</option>
            )}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] md:col-span-2">
            <span className="font-semibold text-slate-700">Account email</span>
            <input
              name="email"
              type="email"
              required
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]"
              placeholder="user@example.com"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px]">
            <span className="font-semibold text-slate-700">Role</span>
            <select name="role" required className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]">
              {ASSIGN_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px]">
            <span className="font-semibold text-slate-700">Display name</span>
            <input name="full_name" className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]" placeholder="Optional" />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px]">
            <span className="font-semibold text-slate-700">Phone</span>
            <input name="phone" className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]" />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] md:col-span-2">
            <span className="font-semibold text-slate-700">Custom password for new user</span>
            <input
              type="password"
              name="password"
              placeholder="Required only when this email does not exist yet"
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]"
              autoComplete="new-password"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px]">
            <span className="font-semibold text-slate-700">Doctor/Junior/Senior doctor working hours</span>
            <input
              name="working_hours"
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]"
              placeholder="If role is Doctor, Junior doctor, or Senior doctor"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] md:col-span-2 lg:col-span-3">
            <input type="checkbox" name="confirm_assign" required className="rounded border-slate-300" />
            <span>I confirm assigning this role for the selected clinic.</span>
          </label>
          <SubmitButton className="btn-primary btn-compact w-fit md:col-span-2 lg:col-span-3" pendingLabel="Saving…">
            Assign
          </SubmitButton>
        </form>
      </section>

      <section className="card-soft overflow-x-auto">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Registered accounts</h2>
        <p className="mt-1 text-[11px] text-slate-600">
          Type <span className="rounded bg-slate-100 px-1 font-mono">confirm</span> before destructive actions.
          Deactivate removes memberships and access. Delete removes the user from platform tables and user registry.
        </p>
        <table className="mt-2 w-full min-w-[640px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              <th className="py-2 pl-2 pr-2">Email</th>
              <th className="py-2 pr-2">User id</th>
              <th className="py-2 pr-2">Created</th>
              <th className="py-2 pr-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="py-1.5 pl-2 pr-2 font-mono text-[11px]">{u.email ?? "—"}</td>
                <td className="py-1.5 pr-2 font-mono text-[10px] text-slate-600">{u.id}</td>
                <td className="py-1.5 pr-2 text-slate-600">{new Date(u.created_at).toLocaleString()}</td>
                <td className="py-1.5 pr-2 text-right">
                  <div className="inline-flex flex-col items-end gap-2">
                    {u.email ? (
                      <form action={superAdminSendPasswordResetAction} className="inline-flex">
                        <input type="hidden" name="email" value={u.email} />
                        <SubmitButton className="btn-secondary btn-compact text-[10px]" pendingLabel="Sending…">
                          Send password reset
                        </SubmitButton>
                      </form>
                    ) : null}
                    <form action={superAdminDeactivateUserEverywhereAction} className="inline-flex flex-col items-end gap-1">
                      <input type="hidden" name="target_user_id" value={u.id} />
                      <label className="flex flex-col items-end gap-1 text-[10px] text-slate-600">
                        <span>Type &quot;confirm&quot; to deactivate</span>
                        <input
                          name="confirm_deactivate_text"
                          required
                          className="w-36 rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                          placeholder="confirm"
                        />
                      </label>
                      <SubmitButton className="btn-secondary btn-compact border-red-200 text-[10px] text-red-800" pendingLabel="…">
                        Deactivate everywhere
                      </SubmitButton>
                    </form>
                    <form action={superAdminDeleteUserFromDatabaseAction} className="inline-flex flex-col items-end gap-1">
                      <input type="hidden" name="target_user_id" value={u.id} />
                      <label className="flex flex-col items-end gap-1 text-[10px] text-slate-600">
                        <span>Type &quot;confirm&quot; to delete user</span>
                        <input
                          name="confirm_delete_text"
                          required
                          className="w-36 rounded border border-red-300 bg-white px-2 py-1 text-[11px]"
                          placeholder="confirm"
                        />
                      </label>
                      <SubmitButton className="btn-secondary btn-compact border-red-300 bg-red-50 text-[10px] text-red-900" pendingLabel="…">
                        Delete from database
                      </SubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length ? <p className="mt-2 text-[12px] text-slate-600">No rows in app_users.</p> : null}
      </section>
    </AppShell>
  );
}
