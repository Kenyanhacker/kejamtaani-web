BEGIN;

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS availability_date DATE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_availability_status_check' AND conrelid = 'public.listings'::regclass) THEN
    ALTER TABLE public.listings ADD CONSTRAINT listings_availability_status_check
      CHECK (availability_status IN ('available', 'soon_available', 'under_negotiation', 'occupied')) NOT VALID;
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.require_review_after_listing_content_edit()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.current_status = 'published' AND (
    NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.building_name IS DISTINCT FROM OLD.building_name OR NEW.estate IS DISTINCT FROM OLD.estate
    OR NEW.address IS DISTINCT FROM OLD.address OR NEW.county IS DISTINCT FROM OLD.county
    OR NEW.latitude IS DISTINCT FROM OLD.latitude OR NEW.longitude IS DISTINCT FROM OLD.longitude
    OR NEW.property_type IS DISTINCT FROM OLD.property_type OR NEW.rent_cents IS DISTINCT FROM OLD.rent_cents
    OR NEW.deposit_rule IS DISTINCT FROM OLD.deposit_rule OR NEW.amenities IS DISTINCT FROM OLD.amenities
    OR NEW.tour_url IS DISTINCT FROM OLD.tour_url
  ) THEN
    NEW.current_status := 'pending_review';
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.unapprove_images_after_listing_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.current_status = 'published' AND NEW.current_status = 'pending_review' THEN
    UPDATE public.listing_images SET is_approved = false WHERE listing_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS listings_require_review_after_content_edit ON public.listings;
CREATE TRIGGER listings_require_review_after_content_edit BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.require_review_after_listing_content_edit();
DROP TRIGGER IF EXISTS listings_unapprove_images_after_edit ON public.listings;
CREATE TRIGGER listings_unapprove_images_after_edit AFTER UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.unapprove_images_after_listing_edit();
REVOKE ALL ON FUNCTION public.require_review_after_listing_content_edit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unapprove_images_after_listing_edit() FROM PUBLIC, anon, authenticated;

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
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
    AND (
      TG_OP = 'INSERT'
      OR OLD.raw_user_meta_data ->> 'terms_accepted_at' IS DISTINCT FROM NEW.raw_user_meta_data ->> 'terms_accepted_at'
      OR OLD.raw_user_meta_data ->> 'terms_version' IS DISTINCT FROM NEW.raw_user_meta_data ->> 'terms_version'
      OR OLD.raw_user_meta_data ->> 'privacy_version' IS DISTINCT FROM NEW.raw_user_meta_data ->> 'privacy_version'
      OR OLD.raw_user_meta_data ->> 'marketing_opt_in' IS DISTINCT FROM NEW.raw_user_meta_data ->> 'marketing_opt_in'
    )
  THEN
    INSERT INTO public.account_policy_acceptances (user_id, terms_version, privacy_version, marketing_opt_in)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'terms_version', NEW.raw_user_meta_data ->> 'privacy_version',
      COALESCE(NEW.raw_user_meta_data ->> 'marketing_opt_in', 'false') = 'true');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_account_policy_acceptance() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_policy_acceptance ON auth.users;
CREATE TRIGGER on_auth_user_policy_acceptance AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.record_account_policy_acceptance();

ALTER TABLE public.viewing_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'viewing_requests_status_check' AND conrelid = 'public.viewing_requests'::regclass) THEN
    ALTER TABLE public.viewing_requests ADD CONSTRAINT viewing_requests_status_check
      CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed')) NOT VALID;
  END IF;
END;
$$;
REVOKE UPDATE ON public.viewing_requests FROM authenticated;
GRANT UPDATE (status, updated_at) ON public.viewing_requests TO authenticated;
DROP POLICY IF EXISTS participants_update_viewing_request ON public.viewing_requests;
CREATE POLICY participants_update_viewing_request ON public.viewing_requests
  FOR UPDATE TO authenticated USING (
    tenant_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.listings WHERE id = viewing_requests.listing_id AND landlord_id = auth.uid()
    )
  ) WITH CHECK (
    tenant_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.listings WHERE id = viewing_requests.listing_id AND landlord_id = auth.uid()
    )
  );
CREATE OR REPLACE FUNCTION public.enforce_viewing_request_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_role TEXT;
  owner_id UUID;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  SELECT landlord_id INTO owner_id FROM public.listings WHERE id = OLD.listing_id;
  IF auth.uid() = OLD.tenant_id AND actor_role = 'tenant'
    AND OLD.status IN ('pending', 'accepted') AND NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  IF auth.uid() = owner_id AND actor_role = 'landlord'
    AND ((OLD.status = 'pending' AND NEW.status IN ('accepted', 'declined'))
      OR (OLD.status = 'accepted' AND NEW.status = 'completed')) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'viewing_request_transition_not_allowed';
END;
$$;
DROP TRIGGER IF EXISTS enforce_viewing_request_transition ON public.viewing_requests;
CREATE TRIGGER enforce_viewing_request_transition BEFORE UPDATE ON public.viewing_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_viewing_request_transition();
REVOKE ALL ON FUNCTION public.enforce_viewing_request_transition() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.listing_reports ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.listing_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
DROP POLICY IF EXISTS signed_in_tenant_report_listing ON public.listing_reports;
CREATE POLICY signed_in_tenant_report_listing ON public.listing_reports
  FOR INSERT TO authenticated WITH CHECK (
    reporter_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'tenant')
    AND EXISTS (SELECT 1 FROM public.listings WHERE id = listing_reports.listing_id AND current_status = 'published' AND is_demo = false)
  );
DROP POLICY IF EXISTS reporters_read_own_listing_reports ON public.listing_reports;
CREATE POLICY reporters_read_own_listing_reports ON public.listing_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());
GRANT SELECT, INSERT ON public.listing_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.limit_viewing_request_rate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.viewing_requests
      WHERE tenant_id = NEW.tenant_id AND created_at > NOW() - INTERVAL '1 day') >= 5 THEN
    RAISE EXCEPTION 'viewing_request_rate_limit_exceeded';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS viewing_request_rate_limit ON public.viewing_requests;
CREATE TRIGGER viewing_request_rate_limit BEFORE INSERT ON public.viewing_requests
  FOR EACH ROW EXECUTE FUNCTION public.limit_viewing_request_rate();
REVOKE ALL ON FUNCTION public.limit_viewing_request_rate() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.limit_listing_report_rate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.listing_reports
      WHERE reporter_id = NEW.reporter_id AND created_at > NOW() - INTERVAL '1 day') >= 5 THEN
    RAISE EXCEPTION 'listing_report_rate_limit_exceeded';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS listing_report_rate_limit ON public.listing_reports;
CREATE TRIGGER listing_report_rate_limit BEFORE INSERT ON public.listing_reports
  FOR EACH ROW EXECUTE FUNCTION public.limit_listing_report_rate();
REVOKE ALL ON FUNCTION public.limit_listing_report_rate() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::JSONB,
  email_alerts BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_manage_own_saved_searches ON public.saved_searches;
CREATE POLICY users_manage_own_saved_searches ON public.saved_searches
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('access', 'correction', 'deletion')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_create_own_privacy_requests ON public.privacy_requests;
CREATE POLICY users_create_own_privacy_requests ON public.privacy_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS users_read_own_privacy_requests ON public.privacy_requests;
CREATE POLICY users_read_own_privacy_requests ON public.privacy_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT ON public.privacy_requests TO authenticated;

ALTER TABLE public.listing_interactions ALTER COLUMN actor_user_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.get_aggregate_listing_metrics()
RETURNS TABLE (interaction_type TEXT, interaction_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT interaction_type, COUNT(*)::BIGINT FROM public.listing_interactions
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY interaction_type ORDER BY interaction_type;
$$;
REVOKE ALL ON FUNCTION public.get_aggregate_listing_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_aggregate_listing_metrics() TO service_role;

CREATE OR REPLACE FUNCTION public.run_retention_cleanup()
RETURNS TABLE (viewing_requests_deleted BIGINT, old_interactions_anonymized BIGINT, listings_archived BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.viewing_requests WHERE preferred_date < CURRENT_DATE - INTERVAL '6 months';
  GET DIAGNOSTICS viewing_requests_deleted = ROW_COUNT;
  UPDATE public.listing_interactions SET actor_user_id = NULL, landlord_id = NULL
    WHERE (actor_user_id IS NOT NULL OR landlord_id IS NOT NULL) AND created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS old_interactions_anonymized = ROW_COUNT;
  UPDATE public.listings SET current_status = 'archived', updated_at = NOW()
    WHERE current_status NOT IN ('published', 'archived')
      AND (created_at < NOW() - INTERVAL '90 days' OR expires_at < NOW() - INTERVAL '90 days');
  GET DIAGNOSTICS listings_archived = ROW_COUNT;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.run_retention_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_retention_cleanup() TO service_role;

DROP POLICY IF EXISTS published_listings_read ON public.listings;
CREATE POLICY published_listings_read ON public.listings FOR SELECT TO anon, authenticated USING (
  (current_status = 'published' AND is_demo = false AND (expires_at IS NULL OR expires_at > NOW()))
  OR landlord_id = auth.uid()
);
DROP POLICY IF EXISTS approved_listing_images_read ON public.listing_images;
CREATE POLICY approved_listing_images_read ON public.listing_images FOR SELECT TO anon, authenticated USING (
  (is_approved = true AND EXISTS (
    SELECT 1 FROM public.listings
    WHERE listings.id = listing_images.listing_id AND listings.current_status = 'published'
      AND listings.is_demo = false AND (listings.expires_at IS NULL OR listings.expires_at > NOW())
  ))
  OR EXISTS (SELECT 1 FROM public.listings WHERE listings.id = listing_images.listing_id AND listings.landlord_id = auth.uid())
);

DROP POLICY IF EXISTS listing_photos_approved_read ON storage.objects;
CREATE POLICY listing_photos_approved_read ON storage.objects FOR SELECT TO anon, authenticated USING (
  bucket_id = 'listing-photos' AND (
    (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::TEXT)
    OR EXISTS (
      SELECT 1 FROM public.listing_images
      JOIN public.listings ON listings.id = listing_images.listing_id
      WHERE listing_images.storage_path = storage.objects.name AND listing_images.is_approved = true
        AND listings.current_status = 'published' AND listings.is_demo = false
        AND (listings.expires_at IS NULL OR listings.expires_at > NOW())
    )
  )
);

COMMIT;
