"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { sendVaccinationAlertEmail } from "@/lib/email/send-vaccination-alert-email";
import { vaccinationReminderUrls } from "@/lib/reminders/vaccination-reminder-urls";
import { createClient } from "@/lib/supabase/server";

export async function createVaccinationRecord(formData: FormData) {
  const petId = String(formData.get("pet_id") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const vaccineName = String(formData.get("vaccine_name") ?? "").trim();
  const dose = String(formData.get("dose") ?? "").trim();
  const administeredOn = String(formData.get("administered_on") ?? "").trim();
  const dueOn = String(formData.get("due_on") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!petId || !vaccineName) {
    throw new Error("Pet and vaccine name are required.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { error } = await supabase.from("vaccination_records").insert({
    clinic_id,
    branch_id: branchId || null,
    pet_id: petId,
    vaccine_name: vaccineName,
    dose: dose || null,
    administered_on: administeredOn || null,
    due_on: dueOn || null,
    status: status || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/vaccinations");
}

export async function updateVaccinationRecord(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const dueOn = String(formData.get("due_on") ?? "").trim();

  if (!id) throw new Error("Vaccination record id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { error } = await supabase
    .from("vaccination_records")
    .update({
      status: status || null,
      due_on: dueOn || null,
      reminder_sent_at: status.toLowerCase() === "reminded" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("clinic_id", clinic_id);

  if (error) throw new Error(error.message);
  revalidatePath("/vaccinations");
}

export async function sendVaccinationReminderNow(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Vaccination record id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: row, error: rowErr } = await supabase
    .from("vaccination_records")
    .select("id, due_on, pets(owner_id, name)")
    .eq("id", id)
    .eq("clinic_id", clinic_id)
    .maybeSingle();
  if (rowErr) throw new Error(rowErr.message);
  if (!row) throw new Error("Vaccination record not found.");

  const pets = row.pets as { owner_id?: string | null; name?: string | null } | { owner_id?: string | null; name?: string | null }[] | null;
  const pet = Array.isArray(pets) ? pets[0] : pets;
  const ownerId = pet?.owner_id ?? null;
  if (!ownerId) throw new Error("No owner linked to this pet.");

  const { data: owner, error: ownerErr } = await supabase
    .from("owners")
    .select("user_id, email, full_name")
    .eq("id", ownerId)
    .maybeSingle();
  if (ownerErr) throw new Error(ownerErr.message);

  const message = `${pet?.name ?? "Your pet"} has a vaccination due on ${row.due_on ?? "the scheduled date"}.`;

  type VaccinationReminderInsert = {
    clinic_id: string;
    owner_id: string;
    user_id: string | null;
    channel: "push" | "email";
    title: string;
    message: string;
    payload: { event: string; entity_id: string; email?: string };
  };

  const inserts: VaccinationReminderInsert[] = [
    {
      clinic_id,
      owner_id: ownerId,
      user_id: owner?.user_id ?? null,
      channel: "push",
      title: "Vaccination due reminder",
      message,
      payload: { event: "vaccination_due_manual", entity_id: row.id },
    },
  ];
  if (owner?.email) {
    inserts.push({
      clinic_id,
      owner_id: ownerId,
      user_id: owner?.user_id ?? null,
      channel: "email",
      title: "Vaccination due reminder",
      message,
      payload: { event: "vaccination_due_manual", entity_id: row.id, email: owner.email },
    });
  }

  const { error: insertErr } = await supabase.from("notifications").insert(inserts);
  if (insertErr) throw new Error(insertErr.message);

  if (owner?.email) {
    const { data: token, error: tokenErr } = await supabase.rpc("ensure_vaccination_reminder_token", {
      p_vaccination_record_id: row.id,
    });
    if (!tokenErr && token) {
      const { data: clinicRow } = await supabase.from("clinics").select("name").eq("id", clinic_id).maybeSingle();
      const links = vaccinationReminderUrls(String(token));
      const { data: vaxDetail } = await supabase
        .from("vaccination_records")
        .select("vaccine_name, dose, due_on")
        .eq("id", row.id)
        .maybeSingle();
      await sendVaccinationAlertEmail({
        to: owner.email,
        ownerName: owner.full_name?.trim() || "there",
        petName: pet?.name?.trim() || "your pet",
        clinicName: clinicRow?.name?.trim() || "Your clinic",
        vaccineName: vaxDetail?.vaccine_name ?? "Vaccination",
        dose: vaxDetail?.dose,
        dueOn: vaxDetail?.due_on,
        respondUrl: links.respondPage,
        markDoneUrl: links.completed,
        notDoneUrl: links.notDone,
        optOutUrl: links.optOut,
      });
    }
  }

  const { error: updateErr } = await supabase
    .from("vaccination_records")
    .update({ reminder_sent_at: new Date().toISOString(), status: "reminded" })
    .eq("id", row.id)
    .eq("clinic_id", clinic_id);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath("/vaccinations");
  revalidatePath("/notifications-center");
}

export async function createVaccinationAlertFromVisit(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  const vaccineName = String(formData.get("vaccine_name") ?? "").trim();
  const dose = String(formData.get("dose") ?? "").trim();
  const dueOn = String(formData.get("due_on") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!visitId || !vaccineName) {
    throw new Error("Visit and vaccine name are required.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select("id, branch_id, pet_id, owner_id, owners(full_name, email), pets(name), branches(name)")
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();
  if (visitError) throw new Error(visitError.message);
  if (!visit) throw new Error("Visit not found.");

  const ownerRaw = visit.owners as { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
  const owner = Array.isArray(ownerRaw) ? ownerRaw[0] ?? null : ownerRaw;
  const petRaw = visit.pets as { name?: string | null } | { name?: string | null }[] | null;
  const pet = Array.isArray(petRaw) ? petRaw[0] ?? null : petRaw;
  const branchRaw = visit.branches as { name?: string | null } | { name?: string | null }[] | null;
  const branch = Array.isArray(branchRaw) ? branchRaw[0] ?? null : branchRaw;

  const { data: clinicRow } = await supabase.from("clinics").select("name").eq("id", clinic_id).maybeSingle();

  const reminderSentAt = owner?.email ? new Date().toISOString() : null;
  const { data: vaxInserted, error: insertError } = await supabase
    .from("vaccination_records")
    .insert({
      clinic_id,
      branch_id: visit.branch_id ?? null,
      pet_id: visit.pet_id,
      vaccine_name: vaccineName,
      dose: dose || null,
      due_on: dueOn || null,
      status: owner?.email ? "reminded" : "scheduled",
      reminder_sent_at: reminderSentAt,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  const { data: ownerRow } = await supabase
    .from("owners")
    .select("user_id")
    .eq("id", visit.owner_id)
    .maybeSingle();

  if (vaxInserted?.id && visit.owner_id) {
    await supabase.from("notifications").insert({
      clinic_id,
      owner_id: visit.owner_id,
      user_id: ownerRow?.user_id ?? null,
      channel: "push",
      title: "Vaccination reminder",
      message: `${pet?.name?.trim() || "Your pet"}: ${vaccineName} is due on ${dueOn || "the scheduled date"}.`,
      payload: { kind: "vaccination_reminder", event: "vaccination_due", entity_id: vaxInserted.id },
    });
    try {
      await supabase.rpc("ensure_vaccination_reminder_token", {
        p_vaccination_record_id: vaxInserted.id,
      });
    } catch {
      /* optional */
    }
  }

  if (owner?.email) {
    await sendVaccinationAlertEmail({
      to: owner.email,
      ownerName: owner.full_name?.trim() || "there",
      petName: pet?.name?.trim() || "your pet",
      clinicName: clinicRow?.name?.trim() || "GreenCoatVets",
      branchName: branch?.name?.trim() || null,
      vaccineName,
      dose,
      dueOn,
      notes,
    });
  }

  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/vaccinations");
}
