# Database migration catalog (from scratch)

Apply **in numeric order** (`001` → `100`). Each file is a full copy of the production Supabase migration with a handover header.

| # | Handover file | Original (`supabase/migrations/`) | What it does |
|---|---------------|-----------------------------------|--------------|
| 001 | `001_initial_schema.sql` | `20260320194500_initial_schema.sql` | Creates core tables: clinics, branches, owners, pets, appointments, visits, prescriptions, inventory, ecommerce (products/cart/orders), staff, memberships, and related enums. |
| 002 | `002_rls_policies.sql` | `20260320201000_rls_policies.sql` | Enables Row Level Security and tenant helper functions (has_clinic_access, role checks) plus baseline policies on core tables. |
| 003 | `003_atomic_order_rpc.sql` | `20260320230000_atomic_order_rpc.sql` | Atomic place-order RPC for ecommerce checkout. |
| 004 | `004_atomic_cart_order_rpc.sql` | `20260320233000_atomic_cart_order_rpc.sql` | Adds cart-checkout RPC that converts a cart into an order in one transaction. |
| 005 | `005_payment_pending_flow.sql` | `20260320235500_payment_pending_flow.sql` | Supports pending payment / Razorpay-style checkout state on orders. |
| 006 | `006_storage_medical_files_policies.sql` | `20260321001000_storage_medical_files_policies.sql` | Storage bucket policies for medical-files (visit docs, PDFs, attachments). |
| 007 | `007_services_module.sql` | `20260321013000_services_module.sql` | Clinic services catalog module for bookable/billed services. |
| 008 | `008_contact_inquiries.sql` | `20260321021000_contact_inquiries.sql` | Website contact form inquiries table + policies. |
| 009 | `009_owner_self_registration_policy.sql` | `20260321024500_owner_self_registration_policy.sql` | RLS so pet owners can create their own owner profile on signup. |
| 010 | `010_clinic_role_invites.sql` | `20260321032000_clinic_role_invites.sql` | Invite tokens for joining a clinic with a role (QR / email invites). |
| 011 | `011_user_registry_and_role_assignment.sql` | `20260321035500_user_registry_and_role_assignment.sql` | Keep function callable only from privileged contexts (SQL editor/service role). |
| 012 | `012_super_admin_platform_controls.sql` | `20260321043000_super_admin_platform_controls.sql` | super admin platform controls |
| 013 | `013_platform_super_admin_without_clinic.sql` | `20260321050000_platform_super_admin_without_clinic.sql` | platform super admin without clinic |
| 014 | `014_rbac_hierarchy_and_qr_permissions.sql` | `20260321062000_rbac_hierarchy_and_qr_permissions.sql` | rbac hierarchy and qr permissions |
| 015 | `015_clinic_images_and_upload_policies.sql` | `20260321070000_clinic_images_and_upload_policies.sql` | clinic images and upload policies |
| 016 | `016_owners_photo_url.sql` | `20260321080000_owners_photo_url.sql` | owners photo url |
| 017 | `017_invite_tokens_without_pgcrypto.sql` | `20260321100000_invite_tokens_without_pgcrypto.sql` | gen_random_bytes() requires pgcrypto; some DBs don't have it enabled. |
| 018 | `018_peek_invite_app_users_manual_roles.sql` | `20260321120000_peek_invite_app_users_manual_roles.sql` | Preview invite (for mobile QR UX) without consuming. |
| 019 | `019_app_users_manual_clinic_slug.sql` | `20260321130000_app_users_manual_clinic_slug.sql` | Human-readable clinic picker: FK to clinics.slug (unique) gives a dropdown in Supabase Table Editor. |
| 020 | `020_single_active_membership_per_clinic.sql` | `20260321140000_single_active_membership_per_clinic.sql` | Problem: assign_user_clinic_role only activated the new role row; older rows for the same |
| 021 | `021_clinic_default_branch_and_backfill.sql` | `20260321160000_clinic_default_branch_and_backfill.sql` | Every clinic should have at least one branch so appointments, inventory, etc. can reference branch_id. |
| 022 | `022_platform_branding.sql` | `20260321170000_platform_branding.sql` | Platform-wide product name and logo (web, mobile in-app, marketing site, favicon). |
| 023 | `023_doctor_pet_owner_invite_qr.sql` | `20260322120000_doctor_pet_owner_invite_qr.sql` | Allow doctors (same as receptionists) to create pet_owner invite QRs from mobile / API. |
| 024 | `024_appointment_time_change_requests.sql` | `20260322140000_appointment_time_change_requests.sql` | Pet owners request new times; clinic staff approve and apply (or reject). |
| 025 | `025_staff_profile_photo_and_public_rpc.sql` | `20260322160000_staff_profile_photo_and_public_rpc.sql` | Public-facing staff fields + safe self-service updates from the mobile app. |
| 026 | `026_marketing_site_admin.sql` | `20260323140000_marketing_site_admin.sql` | Marketing website: public content + super-admin-only management (login via Supabase Auth). |
| 027 | `027_marketing_editor_blog_analytics.sql` | `20260323180000_marketing_editor_blog_analytics.sql` | Marketing editor role (blog-only), public blog read, page-view analytics. |
| 028 | `028_clinics_marketing_editor_select.sql` | `20260323200000_clinics_marketing_editor_select.sql` | Allow marketing editors to read their assigned clinic row (has_clinic_access excludes them). |
| 029 | `029_owner_portal_rls_and_rpc.sql` | `20260324120000_owner_portal_rls_and_rpc.sql` | Pet owner portal: owners can manage their pets and book appointments for their clinic. |
| 030 | `030_clinics_pet_owner_select.sql` | `20260325120000_clinics_pet_owner_select.sql` | Pet owners may read clinic rows for clinics they belong to (for portal UI; has_clinic_access is staff-only). |
| 031 | `031_marketing_website_branded_for_clinic.sql` | `20260325140000_marketing_website_branded_for_clinic.sql` | Optional: which clinic this marketing deployment is "branded for" when there is no host/subdomain match. |
| 032 | `032_marketing_footer_nav.sql` | `20260325160000_marketing_footer_nav.sql` | Configurable marketing site footer columns and links (super admin). |
| 033 | `033_place_order_cart_security_definer_store_rls.sql` | `20260325200000_place_order_cart_security_definer_store_rls.sql` | Allow pet owners to complete cart checkout via RPC (RLS-safe) and public product catalog reads. |
| 034 | `034_platform_payment_settings_owner_products.sql` | `20260325210000_platform_payment_settings_owner_products.sql` | Platform-wide Razorpay credentials (super admin only via RLS; website API uses service role). |
| 035 | `035_product_summary_image_urls.sql` | `20260325220000_product_summary_image_urls.sql` | Retail-style product content: short summary for cards, gallery URLs for PDP (JSON array of strings). |
| 036 | `036_appointments_owner_insert_fix_and_marketing_faqs.sql` | `20260326100000_appointments_owner_insert_fix_and_marketing_faqs.sql` | Fix owner appointment booking recursion and add editable marketing FAQs. |
| 037 | `037_marketing_reviews_and_doctor_profile_requirements.sql` | `20260326113000_marketing_reviews_and_doctor_profile_requirements.sql` | Marketing reviews CMS + mandatory doctor profile fields during onboarding. |
| 038 | `038_super_admin_refresh_user_registry.sql` | `20260326130000_super_admin_refresh_user_registry.sql` | Super-admin cleanup for user registry consistency. |
| 039 | `039_website_admin_access_code.sql` | `20260326142000_website_admin_access_code.sql` | Website marketing admin login gate code (super-admin controlled). |
| 040 | `040_fix_assign_user_clinic_role_overload.sql` | `20260326150000_fix_assign_user_clinic_role_overload.sql` | Resolve ambiguous overloads after adding doctor working_hours to assign_user_clinic_role. |
| 041 | `041_web_portal_orders_notifications_attachments_indexes.sql` | `20260328120000_web_portal_orders_notifications_attachments_indexes.sql` | Web portal (apps/web): contact & patient Financial / Communication / Attachments views. |
| 042 | `042_contacts_pets_visit_clinical_evaluations.sql` | `20260328140000_contacts_pets_visit_clinical_evaluations.sql` | Professional PMS: client contacts, patient codes & notes, structured visit clinical evaluation (invoicing-ready). |
| 043 | `043_clinic_invoices_templates_intake.sql` | `20260328180000_clinic_invoices_templates_intake.sql` | Invoicing from visits (medicines + referred tests), editable invoice templates, owner intake on booking. |
| 044 | `044_team_management_rpcs.sql` | `20260328210000_team_management_rpcs.sql` | Team management: clinic admins and super admins can assign roles and remove clinic access safely. |
| 045 | `045_owners_walk_in_insert_policy.sql` | `20260328220000_owners_walk_in_insert_policy.sql` | Allow clinic staff to create guest / walk-in owner records (user_id null) for desk registration. |
| 046 | `046_marketing_homepage_copy.sql` | `20260328240000_marketing_homepage_copy.sql` | Editable homepage headline, tagline, navbar call CTA (super-admin managed). |
| 047 | `047_guest_booking_marketing_popups.sql` | `20260328250000_guest_booking_marketing_popups.sql` | Guest booking from marketing site (no login), merge on signup/email match, optional token claim. |
| 048 | `048_clinic_announcements.sql` | `20260328260000_clinic_announcements.sql` | Clinic-wide announcements: audit row + fan-out to staff notifications (channel push, payload kind clinic_announcement). |
| 049 | `049_branch_web_portal_licenses.sql` | `20260328270000_branch_web_portal_licenses.sql` | Branch web portal access: Razorpay checkout, per-clinic price overrides, license rows per branch. |
| 050 | `050_clinic_invoices_manual_patient_name.sql` | `20260328280000_clinic_invoices_manual_patient_name.sql` | Manual / walk-in invoices: visit optional; denormalized patient name on PDF. |
| 051 | `051_user_consents.sql` | `20260328290000_user_consents.sql` | Records acceptance of data-sharing / disclaimer consent (web, website, future mobile). |
| 052 | `052_booking_without_doctor.sql` | `20260328300000_booking_without_doctor.sql` | Owner/website bookings may omit doctor; clinic assigns staff later. |
| 053 | `053_super_admin_delete_user_from_database.sql` | `20260330090000_super_admin_delete_user_from_database.sql` | super admin delete user from database |
| 054 | `054_super_admin_primary_clinic_and_qr_roles.sql` | `20260330103000_super_admin_primary_clinic_and_qr_roles.sql` | Super admin: allow invite QR generation for all app roles (except super_admin), |
| 055 | `055_platform_branding_store_toggle.sql` | `20260330120000_platform_branding_store_toggle.sql` | platform branding store toggle |
| 056 | `056_clinics_store_toggle.sql` | `20260330123000_clinics_store_toggle.sql` | clinics store toggle |
| 057 | `057_marketing_locations_map_contact_email.sql` | `20260412120000_marketing_locations_map_contact_email.sql` | Interactive map pins for /locations (lat/lng from super admin). |
| 058 | `058_marketing_instagram_embeds.sql` | `20260413120000_marketing_instagram_embeds.sql` | Super-admin curated Instagram post/reel URLs for homepage embeds (official embed.js; no visitor OAuth). |
| 059 | `059_visits_report_pdf.sql` | `20260414100000_visits_report_pdf.sql` | Stored visit summary PDF (medical-files bucket path) for owner/staff download. |
| 060 | `060_instagram_embed_synced_at.sql` | `20260415120000_instagram_embed_synced_at.sql` | When marketing homepage Instagram embeds were last synced from Instagram Graph API (admin "Refresh"). |
| 061 | `061_medical_records_unique_visit_id.sql` | `20260415140000_medical_records_unique_visit_id.sql` | Align with app semantics: one medical_records row per visit (upsert-by-visit_id). |
| 062 | `062_visit_patient_complaint.sql` | `20260415150000_visit_patient_complaint.sql` | Stated reason for visit at presentation (owner/patient complaint), distinct from CC/HPI narrative. |
| 063 | `063_remove_mohali_tdi_marketing_location.sql` | `20260511144000_remove_mohali_tdi_marketing_location.sql` | Remove deprecated Mohali TDI location from public marketing locations. |
| 064 | `064_prescription_catalog_and_template.sql` | `20260511153000_prescription_catalog_and_template.sql` | prescription catalog and template |
| 065 | `065_handwritten_visit_template_and_pdf_source.sql` | `20260511161000_handwritten_visit_template_and_pdf_source.sql` | handwritten visit template and pdf source |
| 066 | `066_website_owner_reports_and_booking_contact_fixes.sql` | `20260512114500_website_owner_reports_and_booking_contact_fixes.sql` | Owner-facing website visit report toggle, better owner profile seeding, and booking consent capture. |
| 067 | `067_website_password_reset_and_web_login_otp.sql` | `20260512125500_website_password_reset_and_web_login_otp.sql` | website password reset and web login otp |
| 068 | `068_marketing_editor_settings_and_reviews_access.sql` | `20260512132000_marketing_editor_settings_and_reviews_access.sql` | marketing editor settings and reviews access |
| 069 | `069_guest_booking_pet_demographics.sql` | `20260512150000_guest_booking_pet_demographics.sql` | guest booking pet demographics |
| 070 | `070_admin_email_action_codes.sql` | `20260512151000_admin_email_action_codes.sql` | admin email action codes |
| 071 | `071_appointment_source_defaults.sql` | `20260512152000_appointment_source_defaults.sql` | appointment source defaults |
| 072 | `072_website_owner_pet_cleanup.sql` | `20260512161000_website_owner_pet_cleanup.sql` | website owner pet cleanup |
| 073 | `073_web_portal_password_reset_tokens.sql` | `20260519120000_web_portal_password_reset_tokens.sql` | web portal password reset tokens |
| 074 | `074_marketing_seo_settings.sql` | `20260519130000_marketing_seo_settings.sql` | marketing seo settings |
| 075 | `075_visit_phone_capture_sessions.sql` | `20260519131000_visit_phone_capture_sessions.sql` | visit phone capture sessions |
| 076 | `076_complete_own_portal_profile.sql` | `20260519140000_complete_own_portal_profile.sql` | Let newly onboarded staff/owners save name + phone reliably (security definer bypasses RLS edge cases). |
| 077 | `077_portal_oauth_email_reconcile.sql` | `20260519150000_portal_oauth_email_reconcile.sql` | Web portal access checks and OAuth email reconciliation (admin-created staff + Google sign-in). |
| 078 | `078_reconcile_portal_oauth_service_role.sql` | `20260519160000_reconcile_portal_oauth_service_role.sql` | Service-role OAuth reconcile (Google sign-in user id may differ from admin-provisioned auth user). |
| 079 | `079_photo_sheet_and_medicine_dosage_per_kg.sql` | `20260520100000_photo_sheet_and_medicine_dosage_per_kg.sql` | Allow photo-sheet visit PDF source; medicine catalog dosage per kg for weight-based Rx. |
| 080 | `080_appointment_type_online_consult.sql` | `20260520105000_appointment_type_online_consult.sql` | appointment type online consult |
| 081 | `081_doctor_availability_vaccination_online_consult.sql` | `20260520110000_doctor_availability_vaccination_online_consult.sql` | Doctor weekly availability, vaccination reminder preferences, Senior Vet online consultation. |
| 082 | `082_fix_senior_vet_consult_video_room.sql` | `20260521120000_fix_senior_vet_consult_video_room.sql` | Fix create_senior_vet_online_consult (correct signature + booking) and in-website video rooms. |
| 083 | `083_add_senior_doctor_enum.sql` | `20260527191000_add_senior_doctor_enum.sql` | add senior doctor enum |
| 084 | `084_senior_doctor_and_online_consult_test_mode.sql` | `20260527192000_senior_doctor_and_online_consult_test_mode.sql` | Add senior doctor role and online consult testing mode. |
| 085 | `085_senior_doctor_admin_assignment_support.sql` | `20260527194000_senior_doctor_admin_assignment_support.sql` | Ensure admin assignment + invite consumption fully support senior_doctor. |
| 086 | `086_online_consult_doctor_join_gate_and_alt_provider.sql` | `20260527203000_online_consult_doctor_join_gate_and_alt_provider.sql` | Add doctor join token + join marker for online consult room gating. |
| 087 | `087_online_consult_call_timer_and_owner_appointments.sql` | `20260528120000_online_consult_call_timer_and_owner_appointments.sql` | Call timer starts when doctor joins; owner portal appointments by email/user link. |
| 088 | `088_super_admin_delete_owners.sql` | `20260528123000_super_admin_delete_owners.sql` | Platform super admin: permanently delete selected owners (and cascaded pets/visits). |
| 089 | `089_clear_logo_as_favicon.sql` | `20260606120000_clear_logo_as_favicon.sql` | Wide logos copied into favicon_url render as blank browser tabs. |
| 090 | `090_marketing_team_members.sql` | `20260607120000_marketing_team_members.sql` | Homepage "Our team" carousel managed from website marketing admin. |
| 091 | `091_website_favicon.sql` | `20260607140000_website_favicon.sql` | Website-only favicon (marketing admin), independent of web portal platform_branding. |
| 092 | `092_primary_clinic_membership_resolution.sql` | `20260618120000_primary_clinic_membership_resolution.sql` | Resolve the same default clinic as the marketing website (resolveClinic) when linking pet owners. |
| 093 | `093_owners_dedupe_unique_clinic_user.sql` | `20260618140000_owners_dedupe_unique_clinic_user.sql` | Prevent duplicate owner rows per clinic+user (fixes "multiple rows returned" on mobile/website). |
| 094 | `094_force_assign_single_clinic.sql` | `20260618160000_force_assign_single_clinic.sql` | Force-link authenticated users to the only active clinic when no membership exists. |
| 095 | `095_staff_profile_senior_doctor.sql` | `20260618170000_staff_profile_senior_doctor.sql` | Allow senior_doctor rows to use update_my_staff_profile (mobile staff profile screen). |
| 096 | `096_marketing_gallery_welcome_video.sql` | `20260722120000_marketing_gallery_welcome_video.sql` | Homepage clinic gallery image URLs + welcome video link for marketing site. |
| 097 | `097_appointment_consent_pdf.sql` | `20260722140000_appointment_consent_pdf.sql` | Booking / walk-in signed consent PDF storage on appointments. |
| 098 | `098_manager_junior_and_junior_doctor_roles.sql` | `20260722144000_manager_junior_and_junior_doctor_roles.sql` | Add manager, junior, and junior_doctor roles. |
| 099 | `099_marketing_page_content.sql` | `20260802120000_marketing_page_content.sql` | Structured marketing page copy/SEO for website admin CMS. |
| 100 | `100_marketing_editor_content_rls.sql` | `20260802121000_marketing_editor_content_rls.sql` | Allow marketing editors to manage FAQs, locations, and footer (content tools). |
