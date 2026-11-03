-- JobUT production migration readiness (READ ONLY)
-- Run the complete script in Runflare pgAdmin Query Tool. It reads catalogs and
-- the Drizzle journal only; it does not inspect application rows.
BEGIN TRANSACTION READ ONLY;

SELECT
  current_database() AS database_name,
  current_schema() AS current_schema,
  current_schemas(false) AS search_path_schemas,
  current_setting('server_version') AS postgres_version;

-- Locate the Drizzle journal without assuming its schema or existence.
SELECT
  n.nspname AS journal_schema,
  c.relname AS journal_table,
  c.relkind AS relation_kind
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = '__drizzle_migrations'
ORDER BY n.nspname;

-- Safely display all journal rows. No dynamic query is executed when the table is absent.
SELECT
  n.nspname AS journal_schema,
  pg_catalog.query_to_xml(
    format('SELECT id, hash, created_at FROM %I.%I ORDER BY created_at, id', n.nspname, c.relname),
    true,
    false,
    ''
  ) AS recorded_migrations
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = '__drizzle_migrations'
  AND c.relkind IN ('r', 'p')
ORDER BY n.nspname;

-- Expected hashes are SHA-256 hashes of the checked-in, unmodified SQL files.
SELECT * FROM (VALUES
  ('0013_regular_silvermane',       1792651399568::bigint, '2959d3e0eb437bfa37711370b3416327b8ba2b94dcae297977b5927e4f77a925'),
  ('0019_bizarre_power_man',        1793603062834::bigint, 'd7c24ffbe38d0ba235935845fc1aba6d0962ffcc004c4678849155ec9bab6fa8'),
  ('0020_wise_phalanx',             1793605038711::bigint, 'd17d32909a899ddf5e4097a3cba31a4a7f2979e1025dadbf80378f2b0bd561a5'),
  ('0021_curved_the_professor',      1793606810236::bigint, 'a5bcd2ddaf7b48b7f654bc6cb3e77575dffeeced8be91d71c3c218b057b77a0a'),
  ('0022_mute_warpath',              1793620762998::bigint, '3dab99ec09f583bd8639a5744f57069c700d65444b5adeabfb178bd2b9fa5a06'),
  ('0023_messy_fabian_cortez',       1793621460513::bigint, '6a9cc48e30ac28fd0defad2d63fc964dba0ce54b67ae4e9dcf8441786b57d459'),
  ('0024_outgoing_crusher_hogan',    1793683517331::bigint, 'd8f9a49a2c63247aa798b5f212efd4785065bbb40b638aae3f86847228d07e9f'),
  ('0025_windy_skreet',              1793684203897::bigint, '91fdc9d3acbd0b27b0e056145a45acdf82e8f1cf8e671b4bd35d6a5430956268')
) AS expected_migration(tag, journal_timestamp, sha256)
ORDER BY journal_timestamp;

-- Expected relations. NULL means absent; non-NULL includes the resolved schema.
SELECT expected.relation_name, to_regclass('public.' || expected.relation_name) AS resolved_relation
FROM (VALUES
  ('candidate_accounts'),
  ('candidate_job_preferences'),
  ('candidate_legal_acceptances'),
  ('candidate_data_requests'),
  ('candidate_data_request_status_events'),
  ('candidate_application_status_notifications'),
  ('candidate_saved_jobs'),
  ('candidate_profile_photos'),
  ('candidate_credentials'),
  ('candidate_credential_documents'),
  ('application_resume_snapshots'),
  ('application_resume_snapshot_credentials'),
  ('job_application_status_history'),
  ('job_applications'),
  ('job_posts')
) AS expected(relation_name)
ORDER BY expected.relation_name;

-- Expected enum types. NULL means absent.
SELECT expected.type_name, to_regtype('public.' || expected.type_name) AS resolved_type
FROM (VALUES
  ('workplace_type'),
  ('employment_type'),
  ('seniority_level'),
  ('application_status'),
  ('candidate_data_request_type'),
  ('candidate_data_request_status'),
  ('candidate_credential_type')
) AS expected(type_name)
ORDER BY expected.type_name;

-- Enum labels and ordering, including the required withdrawn value.
SELECT n.nspname AS type_schema, t.typname AS type_name, e.enumsortorder, e.enumlabel
FROM pg_catalog.pg_type t
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public'
  AND t.typname IN (
    'workplace_type', 'employment_type', 'seniority_level', 'application_status',
    'candidate_data_request_type', 'candidate_data_request_status', 'candidate_credential_type'
  )
ORDER BY t.typname, e.enumsortorder;

-- Column shape for every migration-dependent relation that currently exists.
SELECT
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'candidate_job_preferences', 'candidate_legal_acceptances',
    'candidate_data_requests', 'candidate_data_request_status_events',
    'candidate_application_status_notifications', 'candidate_saved_jobs',
    'candidate_profile_photos', 'candidate_credentials',
    'candidate_credential_documents', 'application_resume_snapshot_credentials'
  )
ORDER BY c.table_name, c.ordinal_position;

-- Primary keys, foreign keys, unique constraints and checks, only for existing objects.
SELECT
  n.nspname AS table_schema,
  rel.relname AS table_name,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    ELSE con.contype::text
  END AS constraint_type,
  pg_get_constraintdef(con.oid, true) AS definition
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = rel.relnamespace
WHERE n.nspname = 'public'
  AND rel.relname IN (
    'candidate_job_preferences', 'candidate_legal_acceptances',
    'candidate_data_requests', 'candidate_data_request_status_events',
    'candidate_application_status_notifications', 'candidate_saved_jobs',
    'candidate_profile_photos', 'candidate_credentials',
    'candidate_credential_documents', 'application_resume_snapshot_credentials'
  )
ORDER BY rel.relname, constraint_type, con.conname;

-- Includes ordinary, partial and unique indexes required by the features.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'candidate_job_preferences', 'candidate_legal_acceptances',
    'candidate_data_requests', 'candidate_data_request_status_events',
    'candidate_application_status_notifications', 'candidate_saved_jobs',
    'candidate_profile_photos', 'candidate_credentials',
    'candidate_credential_documents', 'application_resume_snapshot_credentials'
  )
ORDER BY tablename, indexname;

-- Compact feature readiness summary based only on object presence.
SELECT * FROM (VALUES
  ('candidate preferences / recommendations', to_regclass('public.candidate_job_preferences') IS NOT NULL),
  ('legal acceptance', to_regclass('public.candidate_legal_acceptances') IS NOT NULL),
  ('data requests', to_regclass('public.candidate_data_requests') IS NOT NULL
    AND to_regclass('public.candidate_data_request_status_events') IS NOT NULL
    AND to_regtype('public.candidate_data_request_type') IS NOT NULL
    AND to_regtype('public.candidate_data_request_status') IS NOT NULL),
  ('application notifications', to_regclass('public.candidate_application_status_notifications') IS NOT NULL),
  ('saved jobs', to_regclass('public.candidate_saved_jobs') IS NOT NULL),
  ('application withdrawal', EXISTS (
    SELECT 1 FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'application_status' AND e.enumlabel = 'withdrawn'
  )),
  ('profile photo', to_regclass('public.candidate_profile_photos') IS NOT NULL),
  ('candidate credentials', to_regclass('public.candidate_credentials') IS NOT NULL
    AND to_regclass('public.candidate_credential_documents') IS NOT NULL
    AND to_regclass('public.application_resume_snapshot_credentials') IS NOT NULL
    AND to_regtype('public.candidate_credential_type') IS NOT NULL)
) AS readiness(feature, required_objects_present)
ORDER BY feature;

COMMIT;
