-- ============================================================================
-- SPEAKMATE COMPLETE DATABASE SCHEMA & POLICIES (SUPABASE POSTGRESQL)
-- Production-Ready Schema for English Speaking & Classroom Learning Platform
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES & ROLES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    native_language TEXT DEFAULT 'Bengali',
    bio TEXT,
    country TEXT DEFAULT 'Bangladesh',
    role TEXT CHECK (role IN ('student', 'mentor', 'admin')) DEFAULT 'student',
    status TEXT CHECK (status IN ('pending', 'approved', 'suspended')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- 2. COMMUNITY MEMBERS
CREATE TABLE IF NOT EXISTS public.community_members (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'approved', 'suspended')) DEFAULT 'pending',
    application_reason TEXT,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id),
    suspension_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MENTORS
CREATE TABLE IF NOT EXISTS public.mentors (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'English Speaking Coach',
    bio TEXT,
    expertise TEXT[] DEFAULT ARRAY['IELTS Speaking', 'Conversational Fluency', 'Pronunciation'],
    years_experience INT DEFAULT 2,
    rating NUMERIC(3,2) DEFAULT 4.90,
    total_students INT DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. USER PRESENCE (Heartbeat with auto-expiry)
CREATE TABLE IF NOT EXISTS public.user_presence (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT FALSE,
    in_call BOOLEAN DEFAULT FALSE,
    in_matching BOOLEAN DEFAULT FALSE,
    current_room_id UUID,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_presence_online ON public.user_presence(is_online, in_call, in_matching);

-- 5. SPEAKING SESSIONS (1-on-1 calls)
CREATE TABLE IF NOT EXISTS public.speaking_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('requesting', 'connected', 'ended', 'rejected', 'missed')) DEFAULT 'requesting',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    connected_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INT DEFAULT 0,
    end_reason TEXT,
    media_mode TEXT CHECK (media_mode IN ('audio', 'video')) DEFAULT 'video',
    CONSTRAINT chk_no_self_call CHECK (caller_id <> receiver_id)
);
CREATE INDEX IF NOT EXISTS idx_speaking_sessions_caller ON public.speaking_sessions(caller_id);
CREATE INDEX IF NOT EXISTS idx_speaking_sessions_receiver ON public.speaking_sessions(receiver_id);

-- 6. MATCHING SESSIONS (Atomic matching queue)
CREATE TABLE IF NOT EXISTS public.matching_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('waiting', 'matched', 'cancelled', 'timeout')) DEFAULT 'waiting',
    matched_with UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '45 seconds')
);
CREATE INDEX IF NOT EXISTS idx_matching_waiting ON public.matching_sessions(status, created_at);

-- 7. DAILY CALL USAGE (Asia/Dhaka enforcement)
CREATE TABLE IF NOT EXISTS public.call_usage_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Dhaka'),
    used_seconds INT DEFAULT 0,
    max_allowance_seconds INT DEFAULT 1200, -- 20 minutes default
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_daily_usage UNIQUE (user_id, usage_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_usage_lookup ON public.call_usage_daily(user_id, usage_date);

-- 8. LIVE CLASSES
CREATE TABLE IF NOT EXISTS public.live_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 45,
    max_participants INT DEFAULT 50, -- MVP limit, architected for 200 via SFU
    speaking_mode TEXT CHECK (speaking_mode IN ('raise_hand', 'open_discussion')) DEFAULT 'raise_hand',
    max_active_mics INT DEFAULT 10,
    status TEXT CHECK (status IN ('scheduled', 'live', 'ended')) DEFAULT 'scheduled',
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_classes_mentor ON public.live_classes(mentor_id);
CREATE INDEX IF NOT EXISTS idx_classes_status ON public.live_classes(status, scheduled_at);

-- 9. CLASS PARTICIPANTS
CREATE TABLE IF NOT EXISTS public.class_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('mentor', 'student', 'moderator')) DEFAULT 'student',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    has_mic_permission BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT TRUE,
    CONSTRAINT uq_class_participant UNIQUE (class_id, user_id)
);

-- 10. CLASS SPEAKING QUEUE (Raise Hand)
CREATE TABLE IF NOT EXISTS public.class_speaking_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    raised_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT CHECK (status IN ('waiting', 'approved', 'rejected', 'dismissed')) DEFAULT 'waiting',
    approved_at TIMESTAMPTZ,
    CONSTRAINT uq_active_hand UNIQUE (class_id, user_id, status)
);

-- 11. COURSES
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    category TEXT DEFAULT 'General Speaking',
    level TEXT DEFAULT 'All Levels',
    price_cents INT NOT NULL DEFAULT 0, -- In BDT cents or USD cents
    currency TEXT DEFAULT 'BDT',
    thumbnail_url TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    total_enrollments INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_courses_published ON public.courses(is_published);

-- 12. COURSE SECTIONS & LESSONS
CREATE TABLE IF NOT EXISTS public.course_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_index INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.course_lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    duration_seconds INT DEFAULT 0,
    order_index INT NOT NULL DEFAULT 0,
    is_preview BOOLEAN DEFAULT FALSE,
    resources JSONB DEFAULT '[]'::jsonb
);

-- 13. COURSE ENROLLMENTS
CREATE TABLE IF NOT EXISTS public.course_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    progress_percentage INT DEFAULT 0,
    CONSTRAINT uq_enrollment UNIQUE (course_id, user_id)
);

-- 14. LESSON PROGRESS
CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT FALSE,
    last_position_seconds INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_lesson_progress UNIQUE (enrollment_id, lesson_id)
);

-- 15. PAYMENT ORDERS & TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_type TEXT CHECK (item_type IN ('course', 'subscription')) NOT NULL,
    item_id UUID NOT NULL,
    amount_cents INT NOT NULL,
    currency TEXT DEFAULT 'BDT',
    provider TEXT CHECK (provider IN ('bkash', 'nagad', 'sslcommerz', 'card')) DEFAULT 'bkash',
    status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
    transaction_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE CASCADE,
    provider_reference TEXT,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price_cents INT NOT NULL,
    currency TEXT DEFAULT 'BDT',
    duration_days INT NOT NULL DEFAULT 30,
    daily_speaking_minutes INT NOT NULL DEFAULT 60,
    features JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
    status TEXT CHECK (status IN ('active', 'expired', 'cancelled')) DEFAULT 'active',
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 17. SAFETY: REPORTS & BLOCKS
CREATE TABLE IF NOT EXISTS public.user_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.speaking_sessions(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_block UNIQUE (blocker_id, blocked_id)
);

-- 18. NOTIFICATIONS & AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. PLATFORM SETTINGS
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Initial Platform Settings
INSERT INTO public.platform_settings (key, value)
VALUES
    ('daily_free_minutes', '{"minutes": 20}'::jsonb),
    ('matching_timeout_seconds', '{"seconds": 15}'::jsonb),
    ('max_classroom_attendees', '{"limit": 50}'::jsonb),
    ('max_active_mics_open_discussion', '{"limit": 10}'::jsonb),
    ('payment_gateways_enabled', '{"bkash": true, "nagad": true, "sslcommerz": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed Default Subscription Plans
INSERT INTO public.subscription_plans (code, name, price_cents, currency, duration_days, daily_speaking_minutes, features)
VALUES
    ('free', 'Community Free', 0, 'BDT', 365, 20, '["20 mins daily 1-on-1 speaking", "Join community classes", "Basic vocabulary deck"]'::jsonb),
    ('pro_monthly', 'Pro English Club', 49900, 'BDT', 30, 60, '["60 mins daily 1-on-1 speaking", "Priority partner matching", "Unlimited mentor classrooms", "Raise hand speaking priority", "Downloadable practice PDFs"]'::jsonb),
    ('unlimited_annual', 'Master Fluency Annual', 399900, 'BDT', 365, 120, '["120 mins daily 1-on-1 speaking", "All mentor courses included", "VIP mentor 1-on-1 review", "Verified Fluency Certificate"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_speaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: Public can view safe profile fields; users can update own profile only
CREATE POLICY "Public profiles are viewable by authenticated users" 
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Community: Approved members or admins
CREATE POLICY "Users can view own community membership"
ON public.community_members FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Presence: Visible to authenticated users
CREATE POLICY "Authenticated users view presence"
ON public.user_presence FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users update own presence"
ON public.user_presence FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Speaking Sessions: Participants only
CREATE POLICY "Participants can view their speaking sessions"
ON public.speaking_sessions FOR SELECT TO authenticated 
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Participants can update their speaking sessions"
ON public.speaking_sessions FOR UPDATE TO authenticated 
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Classes: Viewable by authenticated; Manageable by mentor or admin
CREATE POLICY "Authenticated users can view live classes"
ON public.live_classes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Mentors can manage their live classes"
ON public.live_classes FOR ALL TO authenticated USING (auth.uid() = mentor_id);

-- Courses: Published courses visible to all authenticated; Unpublished only to mentor
CREATE POLICY "Users can view published courses"
ON public.courses FOR SELECT TO authenticated 
USING (is_published = true OR auth.uid() = mentor_id);

CREATE POLICY "Mentors can manage own courses"
ON public.courses FOR ALL TO authenticated 
USING (auth.uid() = mentor_id);

-- Course Lessons: Enrolled students or course mentor can view non-preview lessons
CREATE POLICY "Enrolled students can view course lessons"
ON public.course_lessons FOR SELECT TO authenticated 
USING (
    is_preview = true OR
    EXISTS (
        SELECT 1 FROM public.course_sections cs
        JOIN public.courses c ON c.id = cs.course_id
        LEFT JOIN public.course_enrollments ce ON ce.course_id = c.id AND ce.user_id = auth.uid()
        WHERE cs.id = section_id AND (ce.id IS NOT NULL OR c.mentor_id = auth.uid())
    )
);

-- Notifications: Own notifications only
CREATE POLICY "Users can view their notifications"
ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Platform Settings: Read-only for authenticated users
CREATE POLICY "Anyone authenticated can read settings"
ON public.platform_settings FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 20. REFERRAL CODES & TRACKING SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.referral_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(referral_code);

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL,
    status TEXT CHECK (status IN ('invited', 'registered', 'verified', 'qualified', 'rewarded', 'rejected')) DEFAULT 'registered',
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    qualified_at TIMESTAMPTZ,
    rewarded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    rejection_reason TEXT,
    CONSTRAINT chk_no_self_referral CHECK (referrer_user_id <> referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

CREATE TABLE IF NOT EXISTS public.referral_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
    reward_type TEXT CHECK (reward_type IN ('referrer_bonus', 'referred_bonus')) NOT NULL,
    reward_amount_minutes INT NOT NULL DEFAULT 5,
    status TEXT CHECK (status IN ('active', 'consumed', 'revoked')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    CONSTRAINT uq_referral_user_reward UNIQUE (referral_id, user_id, reward_type)
);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON public.referral_rewards(user_id);

CREATE TABLE IF NOT EXISTS public.user_bonus_balances (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_bonus_minutes_earned INT NOT NULL DEFAULT 0,
    remaining_bonus_minutes INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referral_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    referrer_reward_minutes INT NOT NULL DEFAULT 5,
    referred_reward_minutes INT NOT NULL DEFAULT 5,
    minimum_qualifying_session_minutes INT NOT NULL DEFAULT 5,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.referral_settings (id, enabled, referrer_reward_minutes, referred_reward_minutes, minimum_qualifying_session_minutes)
VALUES ('00000000-0000-0000-0000-000000000001', true, 5, 5, 5)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bonus_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read referral codes for attribution"
ON public.referral_codes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view own referral records"
ON public.referrals FOR SELECT TO authenticated
USING (
    auth.uid() = referrer_user_id 
    OR auth.uid() = referred_user_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can view own referral rewards"
ON public.referral_rewards FOR SELECT TO authenticated
USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can read own bonus balance"
ON public.user_bonus_balances FOR SELECT TO authenticated
USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Authenticated users can read referral settings"
ON public.referral_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update referral settings"
ON public.referral_settings FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

