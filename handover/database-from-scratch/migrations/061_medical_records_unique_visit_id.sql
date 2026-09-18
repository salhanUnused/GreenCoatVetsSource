-- =============================================================================
-- Handover migration 061/100
-- Original: supabase/migrations/20260415140000_medical_records_unique_visit_id.sql
-- Purpose: Align with app semantics: one medical_records row per visit (upsert-by-visit_id).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Align with app semantics: one medical_records row per visit (upsert-by-visit_id).
-- Requires removing duplicates before the unique index can be created.

delete from public.medical_records mr
where mr.ctid in (
  select d.ctid
  from (
    select
      ctid,
      row_number() over (
        partition by visit_id
        order by created_at desc nulls last, id desc
      ) as rn
    from public.medical_records
  ) d
  where d.rn > 1
);

create unique index if not exists medical_records_visit_id_key
  on public.medical_records (visit_id);
