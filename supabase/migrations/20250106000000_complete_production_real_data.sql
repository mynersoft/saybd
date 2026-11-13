-- ============================================================================
-- SPEAKMATE COMPLETE PRODUCTION REAL DATA MIGRATION (20250106)
-- Mentor Applications, Practice Invitations, Admin Provisioning & RLS Policies
-- ============================================================================

-- 1. MENTOR APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.mentor_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    title TEXT NOT NULL,
    bio TEXT,
    years_experience INT DEFAULT 0,
    expertise TEXT[] DEFAULT ARRAY[]::TEXT[],
    resume_url TEXT,
    video_intro_url TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_applications_user ON public.mentor_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_mentor_applications_status ON public.mentor_applications(status);

ALTER TABLE public.mentor_applications ENABLE ROW LEVEL SECURITY;

-- Applicants can view their own application
DROP POLICY IF EXISTS "Users can view own mentor application" ON public.mentor_applications;
CREATE POLICY "Users can view own mentor application"
ON public.mentor_applications FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- Authenticated users can submit a mentor application
DROP POLICY IF EXISTS "Users can insert mentor application" ON public.mentor_applications;
CREATE POLICY "Users can insert mentor application"
ON public.mentor_applications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can update/review mentor applications
DROP POLICY IF EXISTS "Admins can update mentor applications" ON public.mentor_applications;
CREATE POLICY "Admins can update mentor applications"
ON public.mentor_applications FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- 2. PRACTICE INVITATIONS TABLE (Invite Friends to Practice Feature)
CREATE TABLE IF NOT EXISTS public.practice_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    room_name TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT CHECK (status IN ('active', 'used', 'cancelled', 'expired')) DEFAULT 'active',
    max_uses INT DEFAULT 1,
    uses_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_practice_invitations_token ON public.practice_invitations(token);
CREATE INDEX IF NOT EXISTS idx_practice_invitations_creator ON public.practice_invitations(creator_id);
CREATE INDEX IF NOT EXISTS idx_practice_invitations_status ON public.practice_invitations(status);

ALTER TABLE public.practice_invitations ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read invitations (to join them via token)
DROP POLICY IF EXISTS "Invitations viewable by token holders" ON public.practice_invitations;
CREATE POLICY "Invitations viewable by token holders"
ON public.practice_invitations FOR SELECT
TO authenticated
USING (TRUE);

-- Users can create their own invitations
DROP POLICY IF EXISTS "Users can create practice invitations" ON public.practice_invitations;
CREATE POLICY "Users can create practice invitations"
ON public.practice_invitations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

-- Creators or Admins can cancel their invitations
DROP POLICY IF EXISTS "Creators can cancel invitations" ON public.practice_invitations;
CREATE POLICY "Creators can cancel invitations"
ON public.practice_invitations FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id OR public.is_admin())
WITH CHECK (auth.uid() = creator_id OR public.is_admin());


-- 3. PRACTICE INVITATION ACCEPTANCES
CREATE TABLE IF NOT EXISTS public.practice_invitation_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invitation_id UUID NOT NULL REFERENCES public.practice_invitations(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'accepted',
    accepted_at TIMESTAMPTZ DEFAULT NOW(),
    session_id UUID REFERENCES public.speaking_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_invitation_acceptances_invitation ON public.practice_invitation_acceptances(invitation_id);
CREATE INDEX IF NOT EXISTS idx_invitation_acceptances_friend ON public.practice_invitation_acceptances(friend_id);

ALTER TABLE public.practice_invitation_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceptances viewable by participants" ON public.practice_invitation_acceptances;
CREATE POLICY "Acceptances viewable by participants"
ON public.practice_invitation_acceptances FOR SELECT
TO authenticated
USING (
    friend_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.practice_invitations pi WHERE pi.id = invitation_id AND pi.creator_id = auth.uid())
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Friends can insert acceptances" ON public.practice_invitation_acceptances;
CREATE POLICY "Friends can insert acceptances"
ON public.practice_invitation_acceptances FOR INSERT
TO authenticated
WITH CHECK (friend_id = auth.uid());


-- 4. BOOTSTRAP INITIAL ADMIN ACCOUNT IF USER EXISTS
-- Ensures mdmahir.ds@gmail.com has role 'admin' and status 'approved'
DO $$
BEGIN
    UPDATE public.profiles
    SET role = 'admin', status = 'approved'
    WHERE LOWER(email) = 'mdmahir.ds@gmail.com';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
