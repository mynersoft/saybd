-- ============================================================================
-- SPEAKMATE COMPLETE MENTOR MANAGEMENT SYSTEM MIGRATION
-- Classes, Classrooms, Courses, Enrollments, Attendance & Verified Earnings
-- ============================================================================

-- 1. ENHANCE LIVE_CLASSES TABLE
ALTER TABLE public.live_classes 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General Speaking',
ADD COLUMN IF NOT EXISTS learning_objectives TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS price_bdt INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS enrollment_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS student_join_window_minutes INT DEFAULT 15,
ADD COLUMN IF NOT EXISTS mentor_enter_window_minutes INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Drop old status check if needed and add comprehensive status
DO $$ 
BEGIN
    ALTER TABLE public.live_classes DROP CONSTRAINT IF EXISTS live_classes_status_check;
    ALTER TABLE public.live_classes ADD CONSTRAINT live_classes_status_check 
    CHECK (status IN ('draft', 'scheduled', 'live', 'completed', 'cancelled'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_classes_mentor_status ON public.live_classes(mentor_id, status);
CREATE INDEX IF NOT EXISTS idx_classes_scheduled_at ON public.live_classes(scheduled_at);

-- 2. CLASS ENROLLMENTS
CREATE TABLE IF NOT EXISTS public.class_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payment_order_id UUID REFERENCES public.payment_orders(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('confirmed', 'attended', 'cancelled')) DEFAULT 'confirmed',
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    CONSTRAINT uq_class_student_enrollment UNIQUE (class_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student ON public.class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class ON public.class_enrollments(class_id);

-- 3. CLASS ATTENDANCE (Server-verified records, strictly isolated from 1-on-1 usage)
CREATE TABLE IF NOT EXISTS public.class_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actual_join_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actual_leave_time TIMESTAMPTZ,
    duration_seconds INT DEFAULT 0,
    class_start_time TIMESTAMPTZ,
    class_end_time TIMESTAMPTZ,
    attendance_status TEXT CHECK (attendance_status IN ('present', 'partial', 'left_early')) DEFAULT 'present',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_class_attendance_class ON public.class_attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_class_attendance_student ON public.class_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_class_attendance_mentor ON public.class_attendance(mentor_id);

-- 4. CLASS SCHEDULE HISTORY (Audit trail for rescheduling)
CREATE TABLE IF NOT EXISTS public.class_schedule_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    old_scheduled_at TIMESTAMPTZ NOT NULL,
    new_scheduled_at TIMESTAMPTZ NOT NULL,
    old_duration_minutes INT,
    new_duration_minutes INT,
    reason TEXT NOT NULL,
    notified_students_count INT DEFAULT 0,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedule_history_class ON public.class_schedule_history(class_id);

-- 5. CLASSROOM SESSIONS (Live room runtime instance)
CREATE TABLE IF NOT EXISTS public.classroom_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL UNIQUE REFERENCES public.live_classes(id) ON DELETE CASCADE,
    session_key TEXT NOT NULL UNIQUE,
    status TEXT CHECK (status IN ('waiting', 'live', 'ended')) DEFAULT 'waiting',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    total_participants INT DEFAULT 0,
    peak_active_mics INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ENHANCE COURSES TABLE
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS short_description TEXT,
ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'Intermediate',
ADD COLUMN IF NOT EXISTS course_language TEXT DEFAULT 'English',
ADD COLUMN IF NOT EXISTS learning_objectives TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS what_you_will_learn TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS student_requirements TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS discount_price_bdt INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_bdt INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('draft', 'pending_review', 'published', 'unpublished', 'rejected', 'archived')) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_courses_mentor_approval ON public.courses(mentor_id, approval_status);

-- 7. ENHANCE COURSE_LESSONS TABLE
ALTER TABLE public.course_lessons
ADD COLUMN IF NOT EXISTS content_text TEXT,
ADD COLUMN IF NOT EXISTS pdf_resources JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS downloadable_files JSONB DEFAULT '[]'::jsonb;

-- 8. COURSE REVIEWS & RATINGS
CREATE TABLE IF NOT EXISTS public.course_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT NOT NULL,
    mentor_response TEXT,
    mentor_responded_at TIMESTAMPTZ,
    is_reported BOOLEAN DEFAULT FALSE,
    report_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_course_review UNIQUE (course_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_course_reviews_course ON public.course_reviews(course_id);

-- 9. MENTOR EARNINGS & VERIFIED SALES LEDGER
CREATE TABLE IF NOT EXISTS public.mentor_earnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.payment_orders(id) ON DELETE CASCADE,
    item_type TEXT CHECK (item_type IN ('course', 'class')) NOT NULL,
    item_id UUID NOT NULL,
    gross_amount_bdt INT NOT NULL,
    platform_commission_bdt INT NOT NULL,
    mentor_net_bdt INT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'verified', 'refunded')) DEFAULT 'verified',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mentor_earnings_mentor ON public.mentor_earnings(mentor_id);

-- 10. MENTOR WITHDRAWALS TABLE
CREATE TABLE IF NOT EXISTS public.mentor_withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount_bdt INT NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('bkash', 'nagad', 'bank')) NOT NULL,
    account_number TEXT NOT NULL,
    account_details TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'paid')) DEFAULT 'pending',
    transaction_ref TEXT,
    notes TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES public.profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_mentor_withdrawals_mentor ON public.mentor_withdrawals(mentor_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_withdrawals ENABLE ROW LEVEL SECURITY;

-- Class Enrollments: Students can view own enrollments; Mentors view their class enrollments
CREATE POLICY "Students can view own class enrollments"
ON public.class_enrollments FOR SELECT TO authenticated
USING (
    auth.uid() = student_id 
    OR EXISTS (
        SELECT 1 FROM public.live_classes lc 
        WHERE lc.id = class_id AND lc.mentor_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Students can enroll themselves in classes"
ON public.class_enrollments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = student_id);

-- Class Attendance: Mentors view attendance for own classes, Students view own attendance
CREATE POLICY "Attendance viewable by participant, mentor or admin"
ON public.class_attendance FOR SELECT TO authenticated
USING (
    auth.uid() = student_id 
    OR auth.uid() = mentor_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Mentors and system can log attendance"
ON public.class_attendance FOR INSERT TO authenticated
WITH CHECK (auth.uid() = mentor_id OR auth.uid() = student_id);

-- Class Schedule History: Viewable by enrolled students, mentor, admin
CREATE POLICY "Schedule history viewable by enrolled students and mentor"
ON public.class_schedule_history FOR SELECT TO authenticated
USING (
    auth.uid() = mentor_id 
    OR EXISTS (
        SELECT 1 FROM public.class_enrollments ce 
        WHERE ce.class_id = class_id AND ce.student_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Course Reviews: Public read for published courses; Enrolled students can insert/update own review
CREATE POLICY "Anyone authenticated can read course reviews"
ON public.course_reviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enrolled students can create review"
ON public.course_reviews FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (
        SELECT 1 FROM public.course_enrollments ce 
        WHERE ce.course_id = course_id AND ce.user_id = auth.uid()
    )
);

CREATE POLICY "Students can update own review"
ON public.course_reviews FOR UPDATE TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Mentors can respond to reviews on own courses"
ON public.course_reviews FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.courses c 
        WHERE c.id = course_id AND c.mentor_id = auth.uid()
    )
);

-- Mentor Earnings: Mentor view only
CREATE POLICY "Mentors can view own earnings"
ON public.mentor_earnings FOR SELECT TO authenticated
USING (auth.uid() = mentor_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Mentor Withdrawals: Mentor view & submit own
CREATE POLICY "Mentors view own withdrawals"
ON public.mentor_withdrawals FOR SELECT TO authenticated
USING (auth.uid() = mentor_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Mentors submit withdrawals"
ON public.mentor_withdrawals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = mentor_id);
