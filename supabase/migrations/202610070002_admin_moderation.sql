BEGIN;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS moderation_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.listing_reports
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.privacy_requests
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.admin_review_listing(
  target_listing UUID,
  approve BOOLEAN,
  moderator UUID,
  note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  listing_status TEXT;
  demo_listing BOOLEAN;
BEGIN
  SELECT current_status, is_demo INTO listing_status, demo_listing
  FROM public.listings WHERE id = target_listing FOR UPDATE;
  IF NOT FOUND OR listing_status <> 'pending_review' OR demo_listing THEN
    RAISE EXCEPTION 'listing_not_pending_review';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = moderator) THEN
    RAISE EXCEPTION 'invalid_moderator';
  END IF;
  IF approve THEN
    UPDATE public.listing_images SET is_approved = true WHERE listing_id = target_listing;
    UPDATE public.listings SET current_status = 'published', published_at = NOW(),
      moderation_note = NULLIF(note, ''), reviewed_at = NOW(), reviewed_by = moderator, updated_at = NOW()
    WHERE id = target_listing;
  ELSE
    UPDATE public.listing_images SET is_approved = false WHERE listing_id = target_listing;
    UPDATE public.listings SET current_status = 'archived',
      moderation_note = NULLIF(note, ''), reviewed_at = NOW(), reviewed_by = moderator, updated_at = NOW()
    WHERE id = target_listing;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_listing(UUID, BOOLEAN, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_listing(UUID, BOOLEAN, UUID, TEXT) TO service_role;

COMMIT;
