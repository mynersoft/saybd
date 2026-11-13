-- ============================================================================
-- SPEAKMATE AUTH USER TRIGGER & PROFILE PROVISIONING (MIGRATION 20250107)
-- Guarantees atomic profile creation, email column, insert RLS, and safe defaults
-- ============================================================================

-- 1. Ensure email column exists on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(LOWER(email));

-- 2. Allow authenticated users to insert their own initial profile row
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 3. Trigger Function: Automatically creates profile upon auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    resolved_full_name TEXT;
    resolved_role TEXT;
    resolved_status TEXT;
BEGIN
    resolved_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1)
    );
    
    -- Safe role assignment: initial admin gets admin, everyone else starts as student
    IF LOWER(COALESCE(NEW.email, '')) = 'mdmahir.ds@gmail.com' THEN
        resolved_role := 'admin';
        resolved_status := 'approved';
    ELSE
        resolved_role := 'student';
        resolved_status := 'approved';
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        native_language,
        country,
        role,
        status,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        resolved_full_name,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        COALESCE(NEW.raw_user_meta_data->>'native_language', 'Bengali'),
        COALESCE(NEW.raw_user_meta_data->>'country', 'Bangladesh'),
        resolved_role,
        resolved_status,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = CASE 
            WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '' 
            THEN EXCLUDED.full_name 
            ELSE public.profiles.full_name 
        END,
        updated_at = NOW();

    -- Provision default presence record
    INSERT INTO public.user_presence (user_id, is_online, last_heartbeat)
    VALUES (NEW.id, FALSE, NOW())
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Ensure trigger never prevents user account creation
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Sync email updates from auth.users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_user_email_updated()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        UPDATE public.profiles
        SET email = NEW.email, updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_updated();
