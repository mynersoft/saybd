-- ============================================================================
-- SPEAKMATE ADMIN BOOTSTRAP, RLS HARDENING & PASSWORD RECOVERY (MIGRATION 20250108)
-- ============================================================================

-- 1. Ensure must_change_password column exists on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- 2. Strict Role Protection Trigger
-- Prevents clients from updating their own 'role' or 'status' to 'admin' or 'mentor' directly.
-- Role updates can only occur via service_role server processes or verified admins.
CREATE OR REPLACE FUNCTION public.protect_profile_roles()
RETURNS TRIGGER AS $$
BEGIN
    -- If role or status is changing
    IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
        -- Allow service_role key or postgres superuser
        IF current_user IN ('postgres', 'service_role') THEN
            RETURN NEW;
        END IF;

        -- If authenticated user is trying to change their own role or status
        IF auth.uid() = OLD.id THEN
            -- Check if user is an existing verified admin
            IF NOT EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role = 'admin' AND status = 'approved'
            ) THEN
                -- Revert to original role and status
                NEW.role := OLD.role;
                NEW.status := OLD.status;
            END IF;
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_roles ON public.profiles;
CREATE TRIGGER trg_protect_profile_roles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_roles();

-- 3. RLS Security Policies for Admin Management
-- Ensure admins can view and manage all profiles
DROP POLICY IF EXISTS "Admins can view and update all profiles" ON public.profiles;
CREATE POLICY "Admins can view and update all profiles"
ON public.profiles FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles admin_p
        WHERE admin_p.id = auth.uid() AND admin_p.role = 'admin' AND admin_p.status = 'approved'
    )
);

-- 4. Course RLS: Published courses visible to everyone, draft courses only to creator mentor or admin
DROP POLICY IF EXISTS "Public can view published courses" ON public.courses;
CREATE POLICY "Public can view published courses"
ON public.courses FOR SELECT
USING (is_published = true OR auth.uid() = mentor_id);

-- 5. Speaking Sessions: Users can only see their own sessions
DROP POLICY IF EXISTS "Users can view own speaking sessions" ON public.speaking_sessions;
CREATE POLICY "Users can view own speaking sessions"
ON public.speaking_sessions FOR SELECT
TO authenticated
USING (caller_id = auth.uid() OR receiver_id = auth.uid());
