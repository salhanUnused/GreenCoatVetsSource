export type Membership = {
  /** Null for platform super admins without a tenant clinic context. */
  clinic_id: string | null;
  role: string;
};

/** Appointment row + common embedded relations from Supabase selects */
export type Appointment = {
  id: string;
  status: string;
  starts_at: string;
  appointment_type?: string;
  branch_id?: string;
  pet_id?: string;
  owner_id?: string;
  doctor_id?: string | null;
  consent_pdf_path?: string | null;
  branches?: { name: string } | null;
  owners?: { full_name?: string | null; phone?: string | null } | null;
  pets?: {
    name: string;
    species: string;
    allergies?: string | null;
    chronic_diseases?: string | null;
    breed?: string | null;
    age_months?: number | null;
    date_of_birth?: string | null;
    photo_url?: string | null;
  } | null;
};

export type Pet = {
  id: string;
  name: string;
  species: string;
  breed?: string | null;
  gender?: string | null;
  /** Approximate age in months (from owner input or staff). */
  age_months?: number | null;
  date_of_birth?: string | null;
  allergies?: string | null;
  photo_url?: string | null;
};

export type Order = {
  id: string;
  status: string;
  grand_total: number;
};

export type VisitSummary = {
  id: string;
  pet_id: string;
  started_at: string | null;
  diagnosis: string | null;
  symptoms?: string | null;
  treatment_plan?: string | null;
  status?: string | null;
  visit_report_pdf_path?: string | null;
  visit_report_pdf_generated_at?: string | null;
  visit_report_pdf_source?: string | null;
};

/** One line from `prescription_items` (portal / visit Rx). */
export type PrescriptionItemLine = {
  id: string;
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
};

/** Prescription header + lines for owner Health / dashboard. */
export type OwnerPrescription = {
  id: string;
  issued_at: string;
  notes: string | null;
  pdf_url: string | null;
  visit_id: string | null;
  pets?: { name?: string | null } | null;
  prescription_items?: PrescriptionItemLine[] | null;
};

/** Visit with a generated PDF report for owner download. */
export type OwnerVisitReport = {
  id: string;
  pet_id: string;
  started_at: string | null;
  visit_report_pdf_path: string;
  visit_report_pdf_generated_at: string | null;
  visit_report_pdf_source?: string | null;
  pet_name: string;
};

/** Owner portal visit timeline row (matches website /account/visits). */
export type OwnerVisitSummaryRow = {
  id: string;
  pet_name: string;
  branch_name: string;
  visited_at: string | null;
  status_label: string | null;
  report_ready: boolean;
  visit_report_pdf_generated_at: string | null;
  visit_report_pdf_source?: string | null;
};

export type StaffDoctorOption = {
  id: string;
  full_name: string;
};

export type ProductListItem = {
  id: string;
  name: string;
  slug?: string | null;
  price: number;
  stock_quantity: number;
  requires_prescription: boolean;
  image_url?: string | null;
  summary?: string | null;
  description?: string | null;
  compare_at_price?: number | null;
};

/** Local cart line for mobile store checkout (persisted on device). */
export type StoreCartLine = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
};

export type AdminMobileStats = {
  appointmentsToday: number;
  pendingTimeChanges: number;
  lowStockSkus: number;
};

export type DoctorNotification = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
};
