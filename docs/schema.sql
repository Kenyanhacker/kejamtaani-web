CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'tenant' CHECK (role IN ('tenant', 'landlord')),
  role_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.create_profile_for_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  initial_role TEXT;
BEGIN
  initial_role := CASE
    WHEN NEW.raw_user_meta_data ->> 'role' = 'landlord' THEN 'landlord'
    ELSE 'tenant'
  END;
  INSERT INTO public.profiles (id, email, role, role_locked)
  VALUES (NEW.id, NEW.email, initial_role, NEW.raw_user_meta_data ? 'role')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_auth_user();

CREATE TABLE IF NOT EXISTS public.account_policy_acceptances (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.account_policy_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_policy_acceptances FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.account_policy_acceptances_id_seq FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS users_read_own_policy_acceptances ON public.account_policy_acceptances;
CREATE POLICY users_read_own_policy_acceptances ON public.account_policy_acceptances
  FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON public.account_policy_acceptances TO authenticated;

CREATE OR REPLACE FUNCTION public.record_account_policy_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  consent_changed BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    consent_changed := true;
  ELSE
    consent_changed :=
      OLD.raw_user_meta_data ->> 'terms_accepted_at' IS DISTINCT FROM NEW.raw_user_meta_data ->> 'terms_accepted_at'
      OR OLD.raw_user_meta_data ->> 'terms_version' IS DISTINCT FROM NEW.raw_user_meta_data ->> 'terms_version'
      OR OLD.raw_user_meta_data ->> 'privacy_version' IS DISTINCT FROM NEW.raw_user_meta_data ->> 'privacy_version'
      OR OLD.raw_user_meta_data ->> 'marketing_opt_in' IS DISTINCT FROM NEW.raw_user_meta_data ->> 'marketing_opt_in';
  END IF;

  IF consent_changed
    AND NULLIF(NEW.raw_user_meta_data ->> 'terms_accepted_at', '') IS NOT NULL
    AND NULLIF(NEW.raw_user_meta_data ->> 'terms_version', '') IS NOT NULL
    AND NULLIF(NEW.raw_user_meta_data ->> 'privacy_version', '') IS NOT NULL
  THEN
    INSERT INTO public.account_policy_acceptances (
      user_id,
      terms_version,
      privacy_version,
      marketing_opt_in
    ) VALUES (
      NEW.id,
      NEW.raw_user_meta_data ->> 'terms_version',
      NEW.raw_user_meta_data ->> 'privacy_version',
      COALESCE(NEW.raw_user_meta_data ->> 'marketing_opt_in', 'false') = 'true'
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_account_policy_acceptance() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_policy_acceptance ON auth.users;
CREATE TRIGGER on_auth_user_policy_acceptance
  AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.record_account_policy_acceptance();

CREATE OR REPLACE FUNCTION public.set_initial_profile_role(requested_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR requested_role NOT IN ('tenant', 'landlord') THEN
    RAISE EXCEPTION 'Invalid profile role request';
  END IF;
  UPDATE public.profiles
  SET role = requested_role, role_locked = true
  WHERE id = auth.uid() AND (role_locked = false OR role = requested_role);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile role has already been set';
  END IF;
END;
$$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
REVOKE UPDATE, INSERT, DELETE ON profiles FROM anon, authenticated;
GRANT SELECT ON profiles TO authenticated;
REVOKE ALL ON FUNCTION public.set_initial_profile_role(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_initial_profile_role(TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  building_name TEXT,
  estate TEXT,
  address TEXT,
  constituency TEXT,
  county TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  property_type TEXT NOT NULL,
  rent_cents BIGINT NOT NULL,
  deposit_months INTEGER NOT NULL DEFAULT 1,
  garbage_fee_cents BIGINT NOT NULL DEFAULT 0,
  water_deposit_cents BIGINT NOT NULL DEFAULT 0,
  water_supply TEXT,
  electricity_arrangement TEXT,
  gated BOOLEAN DEFAULT false,
  cctv BOOLEAN DEFAULT false,
  security_guard BOOLEAN DEFAULT false,
  furnished BOOLEAN DEFAULT false,
  wifi_available BOOLEAN DEFAULT false,
  parking BOOLEAN DEFAULT false,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  deposit_rule TEXT,
  tour_url TEXT,
  pets_policy TEXT,
  availability_status TEXT NOT NULL DEFAULT 'available',
  availability_date DATE,
  move_in_date DATE,
  min_term_months INTEGER,
  current_status TEXT NOT NULL DEFAULT 'draft',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_confirmed_available_at TIMESTAMPTZ
);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS building_name TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS amenities TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS deposit_rule TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS tour_url TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS availability_date DATE;
ALTER TABLE listings ALTER COLUMN is_demo SET DEFAULT false;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listings_availability_status_check'
      AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_availability_status_check
      CHECK (availability_status IN ('available', 'soon_available', 'under_negotiation', 'occupied')) NOT VALID;
  END IF;
END;
$$;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm ON listings USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_listings_estate_trgm ON listings USING GIN (estate gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_listings_description_trgm ON listings USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_published_listing_coordinates
  ON listings(latitude, longitude)
  WHERE current_status = 'published' AND is_demo = false AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE OR REPLACE FUNCTION public.search_listings_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION,
  search_text TEXT DEFAULT NULL,
  estate_filter TEXT DEFAULT NULL,
  type_filter TEXT DEFAULT NULL,
  minimum_rent_cents BIGINT DEFAULT NULL,
  maximum_rent_cents BIGINT DEFAULT NULL,
  water_filter TEXT DEFAULT NULL,
  gated_only BOOLEAN DEFAULT false,
  sort_order TEXT DEFAULT 'newest',
  page_number INTEGER DEFAULT 0,
  page_size INTEGER DEFAULT 24
)
RETURNS TABLE (listing_ids UUID[], total_count BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH candidates AS (
    SELECT
      l.id,
      l.rent_cents,
      l.created_at,
      6371 * 2 * ASIN(LEAST(1, SQRT(
        POWER(SIN(RADIANS(l.latitude - center_lat) / 2), 2)
        + COS(RADIANS(center_lat)) * COS(RADIANS(l.latitude))
        * POWER(SIN(RADIANS(l.longitude - center_lng) / 2), 2)
      ))) AS distance_km
    FROM public.listings AS l
    WHERE l.current_status = 'published'
      AND l.is_demo = false
      AND (l.expires_at IS NULL OR l.expires_at > NOW())
      AND l.availability_status <> 'occupied'
      AND l.latitude IS NOT NULL
      AND l.longitude IS NOT NULL
      AND center_lat BETWEEN -90 AND 90
      AND center_lng BETWEEN -180 AND 180
      AND radius_km IN (2, 5, 10)
      AND l.latitude BETWEEN center_lat - radius_km / 110.574 AND center_lat + radius_km / 110.574
      AND l.longitude BETWEEN
        center_lng - radius_km / (111.320 * GREATEST(ABS(COS(RADIANS(center_lat))), 0.01))
        AND center_lng + radius_km / (111.320 * GREATEST(ABS(COS(RADIANS(center_lat))), 0.01))
      AND (
        search_text IS NULL OR search_text = ''
        OR l.title ILIKE '%' || search_text || '%'
        OR l.estate ILIKE '%' || search_text || '%'
        OR l.county ILIKE '%' || search_text || '%'
        OR l.constituency ILIKE '%' || search_text || '%'
        OR l.description ILIKE '%' || search_text || '%'
      )
      AND (estate_filter IS NULL OR l.estate = estate_filter)
      AND (type_filter IS NULL OR l.property_type = type_filter)
      AND (minimum_rent_cents IS NULL OR l.rent_cents >= minimum_rent_cents)
      AND (maximum_rent_cents IS NULL OR l.rent_cents <= maximum_rent_cents)
      AND (water_filter IS NULL OR l.water_supply = water_filter)
      AND (NOT gated_only OR l.gated = true)
  ),
  nearby AS (
    SELECT *
    FROM candidates
    WHERE candidates.distance_km <= radius_km
  ),
  counted AS (
    SELECT COUNT(*)::BIGINT AS total_count FROM nearby
  ),
  page_rows AS (
    SELECT nearby.id,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN sort_order = 'price-asc' THEN nearby.rent_cents END ASC NULLS LAST,
          CASE WHEN sort_order = 'price-desc' THEN nearby.rent_cents END DESC NULLS LAST,
          CASE WHEN sort_order = 'newest' THEN nearby.created_at END DESC NULLS LAST,
          nearby.id ASC
      ) AS position
    FROM nearby
    ORDER BY
      CASE WHEN sort_order = 'price-asc' THEN nearby.rent_cents END ASC NULLS LAST,
      CASE WHEN sort_order = 'price-desc' THEN nearby.rent_cents END DESC NULLS LAST,
      CASE WHEN sort_order = 'newest' THEN nearby.created_at END DESC NULLS LAST,
      nearby.id ASC
    OFFSET GREATEST(page_number, 0) * LEAST(GREATEST(page_size, 1), 24)
    LIMIT LEAST(GREATEST(page_size, 1), 24)
  )
  SELECT COALESCE(
    (SELECT ARRAY_AGG(page_rows.id ORDER BY page_rows.position) FROM page_rows),
    ARRAY[]::UUID[]
  ), counted.total_count
  FROM counted;
$$;
GRANT EXECUTE ON FUNCTION public.search_listings_within_radius(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT,
  BIGINT, BIGINT, TEXT, BOOLEAN, TEXT, INTEGER, INTEGER
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_listing_review_for_publication()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.current_status = 'published'
    AND OLD.current_status IS DISTINCT FROM 'published'
    AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Listings must be approved before publication';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS listings_require_review_before_publish ON listings;
CREATE TRIGGER listings_require_review_before_publish
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION public.require_listing_review_for_publication();

CREATE OR REPLACE FUNCTION public.require_review_after_listing_content_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.current_status = 'published' AND (
    NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.building_name IS DISTINCT FROM OLD.building_name
    OR NEW.estate IS DISTINCT FROM OLD.estate
    OR NEW.address IS DISTINCT FROM OLD.address
    OR NEW.county IS DISTINCT FROM OLD.county
    OR NEW.latitude IS DISTINCT FROM OLD.latitude
    OR NEW.longitude IS DISTINCT FROM OLD.longitude
    OR NEW.property_type IS DISTINCT FROM OLD.property_type
    OR NEW.rent_cents IS DISTINCT FROM OLD.rent_cents
    OR NEW.deposit_rule IS DISTINCT FROM OLD.deposit_rule
    OR NEW.amenities IS DISTINCT FROM OLD.amenities
    OR NEW.tour_url IS DISTINCT FROM OLD.tour_url
  ) THEN
    NEW.current_status := 'pending_review';
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS listings_require_review_after_content_edit ON listings;
CREATE TRIGGER listings_require_review_after_content_edit
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION public.require_review_after_listing_content_edit();

CREATE OR REPLACE FUNCTION public_unapprove_images_after_listing_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.current_status = 'published' AND NEW.current_status = 'pending_review' THEN
    UPDATE public.listing_images SET is_approved = false WHERE listing_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS listings_unapprove_images_after_edit ON listings;
CREATE TRIGGER listings_unapprove_images_after_edit
  AFTER UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION public_unapprove_images_after_listing_edit();
REVOKE ALL ON FUNCTION public.require_listing_review_for_publication() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_review_after_listing_content_edit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public_unapprove_images_after_listing_edit() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE listing_images ADD COLUMN IF NOT EXISTS storage_path TEXT;
CREATE INDEX IF NOT EXISTS idx_listing_images_storage_path ON listing_images(storage_path);

ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS approved_listing_images_read ON listing_images;
CREATE POLICY approved_listing_images_read ON listing_images
  FOR SELECT TO anon, authenticated USING (
    (
      is_approved = true
      AND EXISTS (
        SELECT 1 FROM public.listings
        WHERE listings.id = listing_images.listing_id
          AND listings.current_status = 'published'
          AND listings.is_demo = false
          AND (listings.expires_at IS NULL OR listings.expires_at > NOW())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_images.listing_id AND listings.landlord_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS landlords_insert_own_listing_images ON listing_images;
CREATE POLICY landlords_insert_own_listing_images ON listing_images
  FOR INSERT TO authenticated WITH CHECK (
    is_approved = false
    AND EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_images.listing_id
        AND listings.landlord_id = auth.uid()
        AND listings.current_status IN ('draft', 'pending_review')
    )
  );
GRANT INSERT ON listing_images TO authenticated;
GRANT SELECT ON listing_images TO anon, authenticated;

CREATE TABLE IF NOT EXISTS viewing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_name TEXT NOT NULL,
  tenant_phone TEXT NOT NULL,
  preferred_date DATE,
  preferred_time TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE viewing_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'viewing_requests_status_check'
      AND conrelid = 'public.viewing_requests'::regclass
  ) THEN
    ALTER TABLE public.viewing_requests
      ADD CONSTRAINT viewing_requests_status_check
      CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed')) NOT VALID;
  END IF;
END;
$$;
ALTER TABLE viewing_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_create_viewing_requests ON viewing_requests;
CREATE POLICY tenants_create_viewing_requests ON viewing_requests
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'tenant'
  ));
DROP POLICY IF EXISTS viewing_participants_read_requests ON viewing_requests;
CREATE POLICY viewing_participants_read_requests ON viewing_requests
  FOR SELECT TO authenticated
  USING (
    tenant_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.listings WHERE listings.id = viewing_requests.listing_id AND listings.landlord_id = auth.uid())
  );
GRANT SELECT, INSERT ON viewing_requests TO authenticated;
REVOKE UPDATE ON viewing_requests FROM authenticated;
GRANT UPDATE (status, updated_at) ON viewing_requests TO authenticated;
DROP POLICY IF EXISTS participants_update_viewing_request ON viewing_requests;
CREATE POLICY participants_update_viewing_request ON viewing_requests
  FOR UPDATE TO authenticated
  USING (
    tenant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = viewing_requests.listing_id
        AND listings.landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = viewing_requests.listing_id
        AND listings.landlord_id = auth.uid()
    )
  );
CREATE OR REPLACE FUNCTION public.enforce_viewing_request_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_role TEXT;
  owner_id UUID;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  SELECT landlord_id INTO owner_id FROM public.listings WHERE id = OLD.listing_id;

  IF auth.uid() = OLD.tenant_id
    AND actor_role = 'tenant'
    AND OLD.status IN ('pending', 'accepted')
    AND NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() = owner_id
    AND actor_role = 'landlord'
    AND ((OLD.status = 'pending' AND NEW.status IN ('accepted', 'declined'))
      OR (OLD.status = 'accepted' AND NEW.status = 'completed')) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'viewing_request_transition_not_allowed';
END;
$$;
DROP TRIGGER IF EXISTS enforce_viewing_request_transition ON viewing_requests;
CREATE TRIGGER enforce_viewing_request_transition
  BEFORE UPDATE ON viewing_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_viewing_request_transition();
REVOKE ALL ON FUNCTION public.enforce_viewing_request_transition() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS listing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE listing_reports ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE listing_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS signed_in_tenant_report_listing ON listing_reports;
CREATE POLICY signed_in_tenant_report_listing ON listing_reports
  FOR INSERT TO authenticated WITH CHECK (
    reporter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'tenant'
    )
    AND EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_reports.listing_id
        AND listings.current_status = 'published'
        AND listings.is_demo = false
    )
  );
DROP POLICY IF EXISTS reporters_read_own_listing_reports ON listing_reports;
CREATE POLICY reporters_read_own_listing_reports ON listing_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());
GRANT SELECT ON listing_reports TO authenticated;
GRANT INSERT ON listing_reports TO authenticated;

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::JSONB,
  email_alerts BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_manage_own_saved_searches ON saved_searches;
CREATE POLICY users_manage_own_saved_searches ON saved_searches
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_searches TO authenticated;

CREATE TABLE IF NOT EXISTS privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('access', 'correction', 'deletion')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_create_own_privacy_requests ON privacy_requests;
CREATE POLICY users_create_own_privacy_requests ON privacy_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS users_read_own_privacy_requests ON privacy_requests;
CREATE POLICY users_read_own_privacy_requests ON privacy_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT ON privacy_requests TO authenticated;

CREATE TABLE IF NOT EXISTS listing_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id TEXT NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  landlord_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'listing_view', 'whatsapp_click', 'phone_click', 'viewing_request'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE listing_interactions ALTER COLUMN actor_user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.limit_listing_interaction_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.listing_interactions
    WHERE actor_user_id = NEW.actor_user_id
      AND created_at > NOW() - INTERVAL '1 minute'
  ) >= 30 THEN
    RAISE EXCEPTION 'interaction_rate_limit_exceeded';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_interaction_rate_limit ON listing_interactions;
CREATE TRIGGER listing_interaction_rate_limit
  BEFORE INSERT ON listing_interactions
  FOR EACH ROW EXECUTE FUNCTION public.limit_listing_interaction_rate();

CREATE OR REPLACE FUNCTION public.limit_viewing_request_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.viewing_requests
    WHERE tenant_id = NEW.tenant_id
      AND created_at > NOW() - INTERVAL '1 day'
  ) >= 5 THEN
    RAISE EXCEPTION 'viewing_request_rate_limit_exceeded';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS viewing_request_rate_limit ON viewing_requests;
CREATE TRIGGER viewing_request_rate_limit
  BEFORE INSERT ON viewing_requests
  FOR EACH ROW EXECUTE FUNCTION public.limit_viewing_request_rate();

CREATE OR REPLACE FUNCTION public.limit_listing_report_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.listing_reports
    WHERE reporter_id = NEW.reporter_id
      AND created_at > NOW() - INTERVAL '1 day'
  ) >= 5 THEN
    RAISE EXCEPTION 'listing_report_rate_limit_exceeded';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS listing_report_rate_limit ON listing_reports;
CREATE TRIGGER listing_report_rate_limit
  BEFORE INSERT ON listing_reports
  FOR EACH ROW EXECUTE FUNCTION public.limit_listing_report_rate();
REVOKE ALL ON FUNCTION public.limit_viewing_request_rate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.limit_listing_report_rate() FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(current_status);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(property_type);
CREATE INDEX IF NOT EXISTS idx_listings_rent ON listings(rent_cents);
CREATE INDEX IF NOT EXISTS idx_listings_landlord ON listings(landlord_id);
CREATE INDEX IF NOT EXISTS idx_listings_location ON listings(county, estate);
CREATE INDEX IF NOT EXISTS idx_interactions_actor_created ON listing_interactions(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_landlord_created ON listing_interactions(landlord_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_created ON saved_searches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_user_created ON privacy_requests(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.run_retention_cleanup()
RETURNS TABLE (viewing_requests_deleted BIGINT, old_interactions_anonymized BIGINT, listings_archived BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.viewing_requests
  WHERE preferred_date < CURRENT_DATE - INTERVAL '6 months';
  GET DIAGNOSTICS viewing_requests_deleted = ROW_COUNT;

  UPDATE public.listing_interactions
  SET actor_user_id = NULL, landlord_id = NULL
  WHERE (actor_user_id IS NOT NULL OR landlord_id IS NOT NULL)
    AND created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS old_interactions_anonymized = ROW_COUNT;

  UPDATE public.listings
  SET current_status = 'archived', updated_at = NOW()
  WHERE current_status <> 'published'
    AND current_status <> 'archived'
    AND (
      created_at < NOW() - INTERVAL '90 days'
      OR expires_at < NOW() - INTERVAL '90 days'
    );
  GET DIAGNOSTICS listings_archived = ROW_COUNT;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.run_retention_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_retention_cleanup() TO service_role;

CREATE OR REPLACE FUNCTION public.get_aggregate_listing_metrics()
RETURNS TABLE (interaction_type TEXT, interaction_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT li.interaction_type, COUNT(*)::BIGINT
  FROM public.listing_interactions AS li
  WHERE li.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY li.interaction_type
  ORDER BY li.interaction_type;
$$;
REVOKE ALL ON FUNCTION public.get_aggregate_listing_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_aggregate_listing_metrics() TO service_role;

GRANT SELECT ON listings TO anon, authenticated;
GRANT INSERT, UPDATE ON listings TO authenticated;
GRANT SELECT, INSERT ON listing_interactions TO authenticated;
REVOKE ALL ON listing_interactions FROM anon;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS published_listings_read ON listings;
CREATE POLICY published_listings_read ON listings
  FOR SELECT TO anon, authenticated USING (
    (current_status = 'published' AND is_demo = false AND (expires_at IS NULL OR expires_at > NOW()))
    OR landlord_id = auth.uid()
  );
DROP POLICY IF EXISTS landlords_insert_own_listings ON listings;
CREATE POLICY landlords_insert_own_listings ON listings
  FOR INSERT TO authenticated
  WITH CHECK (
    landlord_id = auth.uid()
    AND current_status IN ('draft', 'pending_review')
    AND is_demo = false
    AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'landlord'
    )
  );
DROP POLICY IF EXISTS landlords_delete_own_drafts ON listings;
CREATE POLICY landlords_delete_own_drafts ON listings
  FOR DELETE TO authenticated USING (landlord_id = auth.uid() AND current_status <> 'published');
GRANT DELETE ON listings TO authenticated;
DROP POLICY IF EXISTS landlords_update_own_listings ON listings;
CREATE POLICY landlords_update_own_listings ON listings
  FOR UPDATE TO authenticated
  USING (landlord_id = auth.uid())
  WITH CHECK (
    landlord_id = auth.uid()
    AND current_status IN ('draft', 'pending_review', 'archived', 'published')
    AND is_demo = false
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'landlord'
    )
  );

ALTER TABLE listing_interactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON FUNCTION public.limit_listing_interaction_rate() FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS interactions_insert_own ON listing_interactions;
CREATE POLICY interactions_insert_own ON listing_interactions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id::TEXT = listing_interactions.listing_id
        AND listings.current_status = 'published'
        AND listings.is_demo = false
        AND (listings.expires_at IS NULL OR listings.expires_at > NOW())
        AND listings.landlord_id IS NOT DISTINCT FROM listing_interactions.landlord_id
    )
  );
DROP POLICY IF EXISTS interactions_read_participant ON listing_interactions;
CREATE POLICY interactions_read_participant ON listing_interactions
  FOR SELECT TO authenticated
  USING (actor_user_id = auth.uid() OR landlord_id = auth.uid());

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('listing-photos', 'listing-photos', false, 2097152, ARRAY['image/webp'])
  ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/webp'];
  DROP POLICY IF EXISTS listing_photos_owner_upload ON storage.objects;
  CREATE POLICY listing_photos_owner_upload ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
      bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );
  DROP POLICY IF EXISTS listing_photos_owner_delete ON storage.objects;
  CREATE POLICY listing_photos_owner_delete ON storage.objects
    FOR DELETE TO authenticated USING (
      bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );
  DROP POLICY IF EXISTS listing_photos_public_read ON storage.objects;
  DROP POLICY IF EXISTS listing_photos_approved_read ON storage.objects;
  CREATE POLICY listing_photos_approved_read ON storage.objects
    FOR SELECT TO anon, authenticated USING (
      bucket_id = 'listing-photos'
      AND (
        (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::TEXT)
        OR EXISTS (
          SELECT 1
          FROM public.listing_images
          JOIN public.listings ON listings.id = listing_images.listing_id
          WHERE listing_images.storage_path = storage.objects.name
            AND listing_images.is_approved = true
            AND listings.current_status = 'published'
            AND listings.is_demo = false
        )
      )
    );
