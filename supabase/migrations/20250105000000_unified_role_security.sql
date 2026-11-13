-- ============================================================================
-- SPEAKMATE UNIFIED ROLE-BASED ACCESS CONTROL & SECURITY (MIGRATION 20250105)
-- Production-grade RLS, Role Verification & Security Triggers
-- ============================================================================

-- 1. Ensure status includes 'active', 'pending', 'approved', 'suspended', 'banned'
ALTER TABLE public.profiles 
    DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_status_check 
    CHECK (status IN ('active', 'pending', 'approved', 'suspended', 'banned'));

ALTER TABLE public.profiles 
    DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('student', 'mentor', 'admin'));

-- 2. Helper Security Functions (Server-Side / RLS)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    RETURN COALESCE(user_role, 'student');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT public.current_user_role() = 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_mentor()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT public.current_user_role() IN ('mentor', 'admin'));
END;
$$;

-- 3. Security Trigger: Prevent Non-Admins From Self-Elevating Roles or Status
CREATE OR REPLACE FUNCTION public.protect_profile_role_and_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If role or status is being modified
    IF (NEW.role IS DISTINCT FROM OLD.role) OR (NEW.status IS DISTINCT FROM OLD.status) THEN
        -- Only admin users or system triggers can change role/status
        IF NOT public.is_admin() THEN
            -- Revert role and status back to existing values
            NEW.role := OLD.role;
            NEW.status := OLD.status;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_role_and_status();

-- 4. Enable RLS on core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_sessions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Public profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Users can update own non-protected profile fields" ON public.profiles;
CREATE POLICY "Users can update own non-protected profile fields"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- 6. Platform Announcements & Moderation Table (if not exists)
CREATE TABLE IF NOT EXISTS public.platform_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_role TEXT DEFAULT 'all', -- 'all' | 'student' | 'mentor' | 'admin'
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Announcements viewable by target role" ON public.platform_announcements;
CREATE POLICY "Announcements viewable by target role"
ON public.platform_announcements FOR SELECT
TO authenticated
USING (
    target_role = 'all' 
    OR target_role = public.current_user_role()
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.platform_announcements;
CREATE POLICY "Admins can manage announcements"
ON public.platform_announcements FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
