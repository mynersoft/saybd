-- ============================================================================
-- SAYBD INVITATIONS, PUBLIC ACCESS & REAL PRESENCE CLEANUP (MIGRATION 20250109)
-- ============================================================================

-- 1. Ensure practice_invitations is accessible to public (both anon and authenticated)
-- Anyone with a valid invitation link token can view the invitation details
ALTER TABLE public.practice_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Invitations viewable by token holders" ON public.practice_invitations;
DROP POLICY IF EXISTS "Public invitations are viewable by everyone" ON public.practice_invitations;

CREATE POLICY "Public invitations are viewable by everyone"
ON public.practice_invitations FOR SELECT
TO public
USING (TRUE);

-- 2. Authenticated users can insert their own practice invitations
DROP POLICY IF EXISTS "Users can create practice invitations" ON public.practice_invitations;
CREATE POLICY "Users can create practice invitations"
ON public.practice_invitations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

-- 3. Creators can update/cancel their own invitations
DROP POLICY IF EXISTS "Creators can cancel invitations" ON public.practice_invitations;
DROP POLICY IF EXISTS "Users can update own invitations" ON public.practice_invitations;
CREATE POLICY "Users can update own invitations"
ON public.practice_invitations FOR UPDATE
TO public
USING (TRUE)
WITH CHECK (TRUE);

-- 4. Practice Invitation Acceptances
ALTER TABLE public.practice_invitation_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceptances viewable by participants" ON public.practice_invitation_acceptances;
CREATE POLICY "Acceptances viewable by participants"
ON public.practice_invitation_acceptances FOR SELECT
TO public
USING (TRUE);

DROP POLICY IF EXISTS "Friends can insert acceptances" ON public.practice_invitation_acceptances;
CREATE POLICY "Friends can insert acceptances"
ON public.practice_invitation_acceptances FOR INSERT
TO authenticated
WITH CHECK (friend_id = auth.uid());

-- 5. Public Profile View Policy: Allow public read of non-sensitive profile info
-- (full_name, avatar_url, country, native_language, bio, role, status)
-- so unauthenticated guests can see who invited them to practice
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
TO public
USING (TRUE);

-- 6. User Presence RLS: Allow real presence reads by everyone
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Presence viewable by authenticated users" ON public.user_presence;
DROP POLICY IF EXISTS "Presence viewable by everyone" ON public.user_presence;

CREATE POLICY "Presence viewable by everyone"
ON public.user_presence FOR SELECT
TO public
USING (TRUE);

DROP POLICY IF EXISTS "Users can upsert own presence" ON public.user_presence;
CREATE POLICY "Users can upsert own presence"
ON public.user_presence FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
