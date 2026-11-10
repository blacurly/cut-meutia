-- Public daycare directory (katalog publik) for daycares that have not joined
-- Ayomi yet. Partner daycares stay in public.daycares (they need a manager,
-- contact, capacity and prices before they can accept enrollments).
-- A listing becomes a partner when a manager claims it (claimed_daycare_id).
--
-- Data comes from the team's public-source dataset; legal_status describes the
-- evidence in that dataset, not an Ayomi verification decision.

BEGIN;

CREATE TABLE public.daycare_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_dataset text NOT NULL CHECK (source_dataset IN ('dki', 'jabar', 'jatim')),
  source_row integer NOT NULL CHECK (source_row > 0),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 200),
  province_code text NOT NULL CHECK (province_code ~ '^[0-9]{2}$'),
  province_name text NOT NULL,
  city_name text NOT NULL,
  district_name text,
  address text NOT NULL CHECK (char_length(btrim(address)) >= 5),
  postal_code text CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{5}$'),
  facilities_text text NOT NULL DEFAULT '',
  facility_tags text[] NOT NULL DEFAULT '{}',
  public_rating numeric(2,1) CHECK (public_rating IS NULL OR public_rating BETWEEN 0 AND 5),
  public_rating_source text,
  legal_status text NOT NULL
    CHECK (legal_status IN ('referenced', 'claimed_without_reference', 'in_review', 'not_available')),
  legal_reference text,
  legal_reference_url text CHECK (legal_reference_url IS NULL OR legal_reference_url ~ '^https://'),
  npsn text CHECK (npsn IS NULL OR npsn ~ '^[0-9A-Z]{8}$'),
  data_quality_notes text[] NOT NULL DEFAULT '{}',
  -- Storage object paths in bucket "daycare-public-media"; filled once
  -- photos are approved. NULL means the UI shows a neutral placeholder.
  cover_image_path text,
  gallery_paths text[] NOT NULL DEFAULT '{}',
  claimed_daycare_id uuid UNIQUE REFERENCES public.daycares(id) ON DELETE RESTRICT,
  visibility text NOT NULL DEFAULT 'published' CHECK (visibility IN ('published', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_dataset, source_row),
  CHECK (public_rating IS NULL OR public_rating_source IS NOT NULL),
  CHECK (legal_status <> 'referenced' OR legal_reference IS NOT NULL)
);

CREATE INDEX daycare_listings_region_idx
  ON public.daycare_listings (province_code, city_name, district_name);
CREATE INDEX daycare_listings_legal_idx ON public.daycare_listings (legal_status);
CREATE INDEX daycare_listings_facility_tags_idx ON public.daycare_listings USING gin (facility_tags);

ALTER TABLE public.daycare_listings ENABLE ROW LEVEL SECURITY;

-- Public catalog: visitors may read published listings only.
CREATE POLICY daycare_listings_public_read
  ON public.daycare_listings
  FOR SELECT
  TO anon, authenticated
  USING (visibility = 'published');

-- Admins also see hidden listings for moderation.
CREATE POLICY daycare_listings_admin_read
  ON public.daycare_listings
  FOR SELECT
  TO authenticated
  USING (public.app_current_role() = 'admin');

-- Read-only from the Data API. Writes go through the seed script / SQL Editor
-- (postgres role) until an admin RPC exists.
REVOKE ALL ON TABLE public.daycare_listings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.daycare_listings TO anon, authenticated;

COMMIT;
