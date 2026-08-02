-- Structured marketing page copy/SEO for website admin CMS.
alter table public.marketing_site_settings
  add column if not exists page_content jsonb not null default '{}'::jsonb;

comment on column public.marketing_site_settings.page_content is
  'Per-page SEO + section text/image URLs keyed by slug (home, about, services, …).';
