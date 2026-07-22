import Link from "next/link";
import { DEFAULT_PET_SPECIES_BOOKING_VALUE, PET_SPECIES_BOOKING_OPTIONS } from "@saasclinics/lib";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { APPOINTMENT_BOOKING_CONSENT_TEXT } from "@/lib/booking/appointment-consent";
import { BOOKING_PET_GENDER_OPTIONS } from "@/lib/booking/pet-demographics";
import { getOwnerPortalContext } from "@/lib/owner/portal";
import { clinicMetadata } from "@/lib/seo/clinic-metadata";
import { createClient } from "@/lib/supabase/server";
import { AppointmentDateTimeField } from "@/components/site/appointment-datetime-field";
import { BookingDoctorSlotPicker } from "@/components/site/booking-doctor-slot-picker";
import { BookingProgressIndicator } from "@/components/site/booking-progress-indicator";
import { BookingSubmitButton } from "@/components/site/booking-submit-button";
import { ConsentSignatureField } from "@/components/booking/consent-signature-field";
import { submitGuestBooking } from "@/app/book/actions";
import { submitOwnerBooking } from "@/app/book/owner-actions";

const appointmentTypes = ["consultation", "vaccination", "surgery", "grooming", "emergency"] as const;

const field =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3.5 font-body text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25";

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return clinicMetadata({
    clinicName: clinic.name,
    title: `Book a visit | ${clinic.name}`,
    description: `Schedule an appointment at ${clinic.name}.`,
    path: "/book",
  });
}

export default async function BookAppointmentPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const siteClinic = await resolveClinic();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const portal = user ? await getOwnerPortalContext(user.id) : null;
  const bookingClinic = portal?.clinic ?? siteClinic;
  const owner = portal?.owner ?? null;

  const { data: branches, error: branchesError } = await supabase.rpc("get_public_branches_for_clinic", {
    p_clinic_id: bookingClinic.id,
  });

  if (branchesError) throw new Error(branchesError.message);

  const { data: pets } =
    owner && user
      ? await supabase
          .from("pets")
          .select("id, name")
          .eq("clinic_id", bookingClinic.id)
          .eq("owner_id", owner.id)
          .eq("is_active", true)
          .order("name", { ascending: true })
      : { data: null };

  const { data: bookingDoctors } = await supabase.rpc("get_public_booking_doctors", {
    p_clinic_id: bookingClinic.id,
  });
  const doctorRows = (bookingDoctors ?? []) as { id: string; full_name: string; branch_id: string | null }[];
  const hasBookingDoctors = doctorRows.length > 0;

  const branchRows = (branches ?? []) as { id: string; name: string }[];
  const hasOwnerPets = Boolean((pets?.length ?? 0) > 0);
  const walkInMode = searchParams?.walk_in === "1" || searchParams?.walk_in === "true";
  const ownerName = owner?.full_name?.trim() ?? "";
  const ownerPhone = owner?.phone?.trim() ?? "";
  const ownerNeedsName = ownerName.length < 2;
  const ownerNeedsPhone = ownerPhone.length < 8 || ownerPhone.toUpperCase() === "NA";

  const showOwnerForm = Boolean(user && owner);

  return (
    <main className="bg-surface pb-20">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
        <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-background sm:text-4xl">Book an appointment</h1>
            <p className="mt-2 max-w-2xl text-on-surface-variant">
              {showOwnerForm
                ? `Signed in — booking with ${bookingClinic.name}.`
                : `No login required. You’re booking with ${bookingClinic.name}. Create an account later with the same email to see visits in your portal.`}
            </p>
            {walkInMode ? (
              <div className="mt-4 max-w-2xl rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-on-surface">
                Walk-in self check-in is active. Complete this form at reception and the appointment will appear in the clinic schedule for the doctor.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {user ? (
              <Link
                href="/account"
                className="inline-flex items-center justify-center rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
              >
                Account
              </Link>
            ) : (
              <Link
                href="/login?redirect=/book"
                className="inline-flex items-center justify-center rounded-xl border border-primary px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
              >
                Log in
              </Link>
            )}
          </div>
        </div>

        <div className="mb-10 max-w-3xl">
          <BookingProgressIndicator />
        </div>

        {user && !owner ? (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/90 p-5 text-amber-950">
            <p className="text-sm font-semibold">No pet owner profile yet</p>
            <p className="mt-1 text-sm opacity-90">
              Book below as a guest with your email — when you complete signup with the same email, your visit will link automatically. Or{" "}
              <Link href="/signup" className="font-bold underline">
                finish signup first
              </Link>
              .
            </p>
          </div>
        ) : null}

        {showOwnerForm ? (
          <form action={submitOwnerBooking} data-booking-form className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
            {!ownerNeedsName ? <input type="hidden" name="contact_full_name" value={ownerName} /> : null}
            <div className="space-y-8 lg:col-span-8">
              <section className="clinical-shadow rounded-xl bg-surface-container-lowest p-6 sm:p-8">
                <h2 className="mb-6 flex items-center gap-2 font-headline text-xl font-bold text-on-surface">
                  <span className="material-symbols-outlined text-primary">medical_services</span>
                  Visit details
                </h2>
                <p className="mb-4 text-sm text-on-surface-variant">
                  {hasBookingDoctors
                    ? "Pick a doctor and an open time slot, or leave the doctor blank for clinic assignment."
                    : "The clinic will assign a clinician for your visit."}
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Branch</label>
                    <select className={field} name="branch_id" required>
                      <option value="">Select branch</option>
                      {branchRows.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hasOwnerPets ? (
                    <>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Pet</label>
                        <select className={field} name="pet_id" required>
                          <option value="">Select pet</option>
                          {pets?.map((pet) => (
                            <option key={pet.id} value={pet.id}>
                              {pet.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Pet gender</label>
                        <select className={field} name="pet_gender" defaultValue="">
                          <option value="">Keep existing / not sure</option>
                          {BOOKING_PET_GENDER_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-on-surface-variant">Optional for pets already saved in your account.</p>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Pet age (years)</label>
                        <input
                          className={field}
                          name="pet_age_years"
                          type="number"
                          min="0.1"
                          step="0.1"
                          inputMode="decimal"
                          placeholder="Optional for existing pet"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Pet name</label>
                        <input className={field} name="new_pet_name" type="text" required placeholder="Enter pet name" />
                        <p className="mt-1 text-xs text-on-surface-variant">No pets found in your profile. We&apos;ll create this pet now.</p>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Species</label>
                        <select className={field} name="new_pet_species" defaultValue={DEFAULT_PET_SPECIES_BOOKING_VALUE} required>
                          {PET_SPECIES_BOOKING_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Pet gender</label>
                        <select className={field} name="pet_gender" defaultValue="" required>
                          <option value="">Select gender</option>
                          {BOOKING_PET_GENDER_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Pet age (years)</label>
                        <input
                          className={field}
                          name="pet_age_years"
                          type="number"
                          min="0.1"
                          step="0.1"
                          inputMode="decimal"
                          placeholder="e.g. 3"
                          required
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Visit type</label>
                    <select className={field} name="appointment_type" defaultValue="consultation">
                      {appointmentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hasBookingDoctors ? (
                    <BookingDoctorSlotPicker clinicId={bookingClinic.id} doctors={doctorRows} fieldClassName={field} optionalDoctor />
                  ) : (
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Date &amp; time</label>
                      <AppointmentDateTimeField className={field} />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      Chief complaint / main concern
                    </label>
                    <textarea
                      className={`${field} min-h-[88px]`}
                      name="chief_complaint"
                      placeholder="What should the vet focus on? (saved for the clinical record)"
                      rows={3}
                      defaultValue=""
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Known allergies</label>
                    <input className={field} name="allergies" placeholder="None / food, drugs, environmental…" defaultValue="" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      Current medications / supplements
                    </label>
                    <input className={field} name="current_medications" placeholder="None or list as prescribed" defaultValue="" />
                  </div>
                  {ownerNeedsName ? (
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                        Owner full name
                      </label>
                      <input
                        className={field}
                        name="contact_full_name"
                        type="text"
                        defaultValue={ownerName}
                        required
                        autoComplete="name"
                        placeholder="Enter your full name"
                      />
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      Contact phone (confirm)
                    </label>
                    <input
                      className={field}
                      name="contact_phone"
                      type="tel"
                      defaultValue={ownerNeedsPhone ? "" : ownerPhone}
                      required
                      autoComplete="tel"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      Contact email (confirm)
                    </label>
                    <input className={field} name="contact_email" type="email" defaultValue={owner!.email ?? ""} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Notes (optional)</label>
                    <textarea className={`${field} min-h-[100px]`} name="notes" placeholder="Anything else for the team" rows={3} />
                  </div>
                  <div className="sm:col-span-2 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4">
                    <label className="flex items-start gap-3 text-sm text-on-surface">
                      <input
                        type="checkbox"
                        name="booking_consent"
                        required
                        className="mt-1 h-4 w-4 rounded border-outline-variant"
                      />
                      <span className="whitespace-pre-line">{APPOINTMENT_BOOKING_CONSENT_TEXT}</span>
                    </label>
                    <div className="mt-4">
                      <ConsentSignatureField />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <aside className="lg:col-span-4">
              <div className="clinical-shadow sticky top-24 space-y-4 rounded-xl bg-surface-container-lowest p-6">
                <div className="-m-6 mb-4 rounded-t-xl rounded-b-none bg-primary-container px-4 py-4 text-on-primary-container">
                  <h3 className="font-headline text-lg font-bold">Summary</h3>
                  <p className="text-xs opacity-80">Review selections, then confirm.</p>
                </div>
                <p className="text-sm text-on-surface-variant">
                  After submitting, you&apos;ll return to your account. For changes, contact reception or use your portal.
                </p>
                <BookingSubmitButton
                  className="gradient-primary w-full rounded-xl py-4 font-headline text-lg font-bold text-on-primary shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  pendingLabel="Finalizing your appointment…"
                >
                  Confirm appointment
                </BookingSubmitButton>
                <p className="text-center text-[10px] text-on-surface-variant">Subject to clinic confirmation and availability.</p>
              </div>
            </aside>
          </form>
        ) : (
          <form action={submitGuestBooking} data-booking-form className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="space-y-8 lg:col-span-8">
              <section className="clinical-shadow rounded-xl bg-surface-container-lowest p-6 sm:p-8">
                <h2 className="mb-6 flex items-center gap-2 font-headline text-xl font-bold text-on-surface">
                  <span className="material-symbols-outlined text-primary">person</span>
                  Your details
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Full name</label>
                    <input className={field} name="guest_full_name" type="text" required autoComplete="name" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Phone</label>
                    <input className={field} name="guest_phone" type="tel" required autoComplete="tel" placeholder="+91 98765 43210" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Email</label>
                    <input className={field} name="guest_email" type="email" required autoComplete="email" />
                    <p className="mt-1 text-xs text-on-surface-variant">Use the same email when you create an account to link this booking.</p>
                  </div>
                </div>
              </section>

              <section className="clinical-shadow rounded-xl bg-surface-container-lowest p-6 sm:p-8">
                <h2 className="mb-6 flex items-center gap-2 font-headline text-xl font-bold text-on-surface">
                  <span className="material-symbols-outlined text-primary">pets</span>
                  Pet
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Pet name</label>
                    <input className={field} name="pet_name" type="text" required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Species</label>
                    <select className={field} name="pet_species" defaultValue={DEFAULT_PET_SPECIES_BOOKING_VALUE} required>
                      {PET_SPECIES_BOOKING_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-on-surface-variant">Choose canine, feline, exotic, avian, or equine — same categories as in clinic records.</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Pet gender</label>
                    <select className={field} name="pet_gender" defaultValue="" required>
                      <option value="">Select gender</option>
                      {BOOKING_PET_GENDER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Pet age (years)</label>
                    <input
                      className={field}
                      name="pet_age_years"
                      type="number"
                      min="0.1"
                      step="0.1"
                      inputMode="decimal"
                      placeholder="e.g. 2"
                      required
                    />
                  </div>
                </div>
              </section>

              <section className="clinical-shadow rounded-xl bg-surface-container-lowest p-6 sm:p-8">
                <h2 className="mb-6 flex items-center gap-2 font-headline text-xl font-bold text-on-surface">
                  <span className="material-symbols-outlined text-primary">medical_services</span>
                  Visit details
                </h2>
                <p className="mb-4 text-sm text-on-surface-variant">
                  {hasBookingDoctors
                    ? "Select a doctor and time slot when available, or choose a date/time manually below."
                    : "A clinician will be assigned by the clinic after you submit."}
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Branch</label>
                    <select className={field} name="branch_id" required>
                      <option value="">Select branch</option>
                      {branchRows.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Visit type</label>
                    <select className={field} name="appointment_type" defaultValue="consultation">
                      {appointmentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hasBookingDoctors ? (
                    <BookingDoctorSlotPicker clinicId={bookingClinic.id} doctors={doctorRows} fieldClassName={field} optionalDoctor />
                  ) : (
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Date &amp; time</label>
                      <AppointmentDateTimeField className={field} />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      Chief complaint / main concern
                    </label>
                    <textarea
                      className={`${field} min-h-[88px]`}
                      name="chief_complaint"
                      placeholder="What should the vet focus on?"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Known allergies</label>
                    <input className={field} name="allergies" placeholder="None or list" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Current medications</label>
                    <input className={field} name="current_medications" placeholder="None or list" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Notes (optional)</label>
                    <textarea className={`${field} min-h-[100px]`} name="notes" placeholder="Anything else for the team" rows={3} />
                  </div>
                  <div className="sm:col-span-2 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4">
                    <label className="flex items-start gap-3 text-sm text-on-surface">
                      <input
                        type="checkbox"
                        name="booking_consent"
                        required
                        className="mt-1 h-4 w-4 rounded border-outline-variant"
                      />
                      <span className="whitespace-pre-line">{APPOINTMENT_BOOKING_CONSENT_TEXT}</span>
                    </label>
                    <div className="mt-4">
                      <ConsentSignatureField />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <aside className="lg:col-span-4">
              <div className="clinical-shadow sticky top-24 space-y-4 rounded-xl bg-surface-container-lowest p-6">
                <div className="-m-6 mb-4 rounded-t-xl rounded-b-none bg-primary-container px-4 py-4 text-on-primary-container">
                  <h3 className="font-headline text-lg font-bold">Guest booking</h3>
                  <p className="text-xs opacity-80">The clinic receives this request like any other appointment.</p>
                </div>
                <p className="text-sm text-on-surface-variant">
                  You&apos;ll get a confirmation code on the next page. Staff can see this visit in their schedule immediately.
                </p>
                <BookingSubmitButton
                  className="gradient-primary w-full rounded-xl py-4 font-headline text-lg font-bold text-on-primary shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  pendingLabel="Submitting your booking request…"
                >
                  Submit booking request
                </BookingSubmitButton>
                <p className="text-center text-[10px] text-on-surface-variant">Subject to clinic confirmation and availability.</p>
              </div>
            </aside>
          </form>
        )}
      </div>
    </main>
  );
}
