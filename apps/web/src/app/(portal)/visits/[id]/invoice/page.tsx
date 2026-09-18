import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { InvoiceFromVisitClient, type InvoiceDraftLine } from "./invoice-from-visit-client";
import { ensurePrescriptionForVisit } from "@/app/(portal)/visits/ensure-prescription";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { canManageInvoices } from "@/lib/auth/invoice-access";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { resolveSignedImageUrl } from "@/lib/storage/resolve-signed-image-url";

export default async function VisitInvoicePage({ params }: { params: { id: string } }) {
  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/login");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  if (!canManageInvoices(access)) {
    redirect("/dashboard");
  }

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  const { data: visit, error } = await supabase
    .from("visits")
    .select("id, clinic_id, branch_id, owner_id")
    .eq("id", params.id)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!visit) notFound();

  const prescriptionId = await ensurePrescriptionForVisit(visit.id);

  const [{ data: rxItems }, { data: evaluation }, { data: priorInvoices }] = await Promise.all([
    supabase
      .from("prescription_items")
      .select("id, medicine_name, dosage, frequency, duration, instructions")
      .eq("prescription_id", prescriptionId)
      .order("created_at", { ascending: true }),
    supabase.from("visit_clinical_evaluations").select("tests_referred").eq("visit_id", visit.id).maybeSingle(),
    supabase
      .from("clinic_invoices")
      .select("id, invoice_number, grand_total, pdf_storage_path, created_at")
      .eq("visit_id", visit.id)
      .eq("clinic_id", clinic_id)
      .order("created_at", { ascending: false }),
  ]);

  const tests = Array.isArray(evaluation?.tests_referred)
    ? (evaluation?.tests_referred as string[])
    : [];

  const initialLines: InvoiceDraftLine[] = [];

  for (const item of rxItems ?? []) {
    const bits = [item.medicine_name, item.dosage ? `Dosage: ${item.dosage}` : "", item.frequency ? item.frequency : ""]
      .filter(Boolean)
      .join(" · ");
    initialLines.push({
      key: `rx-${item.id}`,
      line_type: "medicine",
      prescription_item_id: item.id,
      description: bits,
      quantity: 1,
      unit_price: 0,
    });
  }

  for (const code of tests) {
    initialLines.push({
      key: `lab-${code}`,
      line_type: "lab_test",
      test_code: code,
      description: `Laboratory / imaging: ${code}`,
      quantity: 1,
      unit_price: 0,
    });
  }

  const signedInvoices: Array<{
    id: string;
    invoice_number: string;
    grand_total: number | null;
    created_at: string;
    pdfUrl: string | null;
  }> = [];

  for (const inv of priorInvoices ?? []) {
    const pdfUrl = inv.pdf_storage_path
      ? await resolveSignedImageUrl(supabase, inv.pdf_storage_path, { expiresIn: 3600 })
      : null;
    signedInvoices.push({
      id: inv.id,
      invoice_number: inv.invoice_number,
      grand_total: inv.grand_total,
      created_at: inv.created_at,
      pdfUrl,
    });
  }

  return (
    <AppShell
      title="Invoice from visit"
      subtitle="Prefilled from prescription medicines and referred tests. Enter prices, then create the PDF invoice."
      activeHref={`/visits/${visit.id}`}
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary text-sm" href={`/visits/${visit.id}`}>
            Back to visit
          </Link>
        </div>
      }
    >
      <div className="workspace-form mx-auto max-w-5xl space-y-6 text-sm">
        {signedInvoices.length ? (
          <section className="card-soft space-y-2">
            <h2 className="font-headline text-base font-bold text-on-background">Invoices for this visit</h2>
            <ul className="space-y-2 text-xs">
              {signedInvoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant/20 bg-surface-container-low/40 px-2.5 py-1.5">
                  <span className="font-mono font-semibold">{inv.invoice_number}</span>
                  <span className="text-on-surface-variant">
                    {new Date(inv.created_at).toLocaleString()} · INR {Number(inv.grand_total ?? 0).toFixed(2)}
                  </span>
                  {inv.pdfUrl ? (
                    <a className="btn-secondary text-xs" href={inv.pdfUrl} target="_blank" rel="noreferrer">
                      Download PDF
                    </a>
                  ) : (
                    <span className="text-on-surface-variant">PDF pending</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="card-soft space-y-4">
          <h2 className="font-headline text-base font-bold text-on-background">New invoice</h2>
          <p className="text-xs text-on-surface-variant">
            Lines are suggested from the visit prescription and clinical evaluation (referred tests). Adjust descriptions
            and pricing before issuing.
          </p>
          <InvoiceFromVisitClient visitId={visit.id} initialLines={initialLines} />
        </section>
      </div>
    </AppShell>
  );
}
