-- ============================================================================
-- SPEAKMATE LEADERBOARD & COMPLETE PROFILE MANAGEMENT MIGRATION
-- Supabase PostgreSQL Schema, Storage Bucket, RLS Policies, and Leaderboard RPC
-- ============================================================================

-- 1. ENRICH PROFILES & MENTORS TABLES WITH OPTIONAL PROFILE FIELDS
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS learning_goals TEXT;

ALTER TABLE public.mentors
ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY['English', 'Bengali'],
ADD COLUMN IF NOT EXISTS intro TEXT;

-- Index for leaderboard queries on profiles
CREATE INDEX IF NOT EXISTS idx_profiles_student_approved 
ON public.profiles(role, status) 
WHERE role = 'student' AND status = 'approved';

-- 2. CREATE STORAGE BUCKET FOR PROFILE IMAGES
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-images', 
    'profile-images', 
    true, 
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- 3. STORAGE ROW LEVEL SECURITY POLICIES
-- Public read for profile avatars
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Public Read Profile Images'
    ) THEN
        CREATE POLICY "Public Read Profile Images"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'profile-images');
    END IF;
END $$;

-- Authenticated users can upload their own profile image into their user directory
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Users Can Upload Own Profile Picture'
    ) THEN
        CREATE POLICY "Users Can Upload Own Profile Picture"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'profile-images' AND
            (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END $$;

-- Authenticated users can update/replace only their own profile image
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Users Can Update Own Profile Picture'
    ) THEN
        CREATE POLICY "Users Can Update Own Profile Picture"
        ON storage.objects FOR UPDATE TO authenticated
        USING (
            bucket_id = 'profile-images' AND
            (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END $$;

-- Authenticated users can delete only their own profile image
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Users Can Delete Own Profile Picture'
    ) THEN
        CREATE POLICY "Users Can Delete Own Profile Picture"
        ON storage.objects FOR DELETE TO authenticated
        USING (
            bucket_id = 'profile-images' AND
            (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END $$;

-- 4. SECURE LEADERBOARD FUNCTION (RPC)
-- Aggregates verified 1-on-1 speaking time strictly in Asia/Dhaka timezone.
-- Strictly excludes mentor classroom time, rejected/missed calls, and returns only public data.
CREATE OR REPLACE FUNCTION public.get_speaking_leaderboard(
    period_filter TEXT DEFAULT 'today',
    limit_count INT DEFAULT 50,
    offset_count INT DEFAULT 0
)
RETURNS TABLE (
    student_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    speaking_seconds BIGINT,
    rank BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    today_dhaka DATE;
    month_start_dhaka DATE;
    year_start_dhaka DATE;
BEGIN
    -- Determine current Asia/Dhaka date boundaries
    today_dhaka := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::DATE;
    month_start_dhaka := DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'))::DATE;
    year_start_dhaka := DATE_TRUNC('year', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'))::DATE;

    RETURN QUERY
    WITH eligible_students AS (
        SELECT p.id, p.full_name, p.avatar_url
        FROM public.profiles p
        WHERE p.role = 'student' AND p.status = 'approved'
    ),
    -- Aggregated 1-on-1 speaking practice usage from daily logs
    aggregated_usage AS (
        SELECT 
            u.user_id,
            SUM(u.used_seconds)::BIGINT AS total_seconds,
            MAX(u.updated_at) AS last_session_at
        FROM public.call_usage_daily u
        WHERE 
            (period_filter = 'today' AND u.usage_date = today_dhaka)
            OR (period_filter = 'monthly' AND u.usage_date >= month_start_dhaka AND u.usage_date < (month_start_dhaka + INTERVAL '1 month')::DATE)
            OR (period_filter = 'yearly' AND u.usage_date >= year_start_dhaka AND u.usage_date < (year_start_dhaka + INTERVAL '1 year')::DATE)
        GROUP BY u.user_id
    ),
    ranked_students AS (
        SELECT 
            es.id AS student_id,
            es.full_name,
            es.avatar_url,
            COALESCE(au.total_seconds, 0)::BIGINT AS speaking_seconds,
            DENSE_RANK() OVER (
                ORDER BY 
                    COALESCE(au.total_seconds, 0) DESC, 
                    au.last_session_at ASC NULLS LAST,
                    es.full_name ASC
            ) AS rank
        FROM eligible_students es
        INNER JOIN aggregated_usage au ON es.id = au.user_id
        WHERE COALESCE(au.total_seconds, 0) > 0
    )
    SELECT 
        rs.student_id,
        rs.full_name,
        rs.avatar_url,
        rs.speaking_seconds,
        rs.rank
    FROM ranked_students rs
    ORDER BY rs.rank ASC, rs.full_name ASC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$;

-- Grant execution to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.get_speaking_leaderboard(TEXT, INT, INT) TO authenticated, anon, service_role;
