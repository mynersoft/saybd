# SayBD — Practice English. Connect. Improve.

Production-minded English learning and speaking practice web application with real-time peer matching, mentor classrooms with Raise Hand & Open Discussion modes, course marketplace with Bangladesh payment integration, and administrative controls.

---

## 1. Architecture Overview

SayBD is architected into four independent layers:

1. **Frontend**: React 19, Vite, Pure JavaScript (ES2022 / JSX), Tailwind CSS, React Router, Lucide Icons.
2. **Database & Auth**: Supabase PostgreSQL with 24+ normalized tables, Row Level Security (RLS) policies, atomic queue matching logic, and Asia/Dhaka daily midnight reset tracking.
3. **Media Transport Abstraction**:
   - `WebRTCProvider`: Low-latency peer-to-peer audio/video for 1-on-1 partner practice using Google STUN nodes.
   - `LiveKitProvider`: SFU (Selective Forwarding Unit) adapter designed for mentor classrooms targeting up to 200 participants without mesh CPU/bandwidth exhaustion.
4. **Payment Abstraction**: Idempotent order logging and signature verification for bKash, Nagad, SSLCommerz, and Cards.

---

## 2. Quick Start & Local Development

### Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Run local dev server (default port 3000)
npm run dev

# 3. Build for production (Cloudflare Pages, Vercel, or Cloud Run)
npm run build
```

The application operates on 100% authentic database records with strict Row Level Security (RLS) policies. When connecting Supabase, all students, mentors, classes, and practice sessions are managed through real backend tables.

---

## 3. Supabase Integration Setup

To connect your real Supabase production project:

1. Create a project on [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in the Supabase Dashboard.
3. Run the SQL migration files located in `/supabase/migrations/`.
4. Copy your project credentials into `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Configure Password Recovery Email OTP in Supabase Dashboard:
   - Go to **Authentication** > **Email Templates** > **Reset Password**.
   - Change Subject to: `SayBD Password Reset Verification Code`
   - Paste the custom template from `/supabase/email-templates/recovery.html`.
   - Ensure the template uses `{{ .Token }}` for the 6-digit numeric OTP code instead of `{{ .ConfirmationURL }}`.
6. Deploy Edge Functions (optional for cloud webhooks):
   ```bash
   supabase functions deploy verify-payment
   supabase functions deploy generate-livekit-token
   ```

---

## 4. Media & SFU Setup (WebRTC & LiveKit)

### 1-on-1 Speaking Calls
- Defaults to native browser WebRTC using STUN servers (`stun:stun.l.google.com:19302`).
- Media tracks are automatically closed when calls end or when skipping to the next partner to prevent active microphone or camera leaks.

### 200-Participant Mentor Classrooms
- Built with a LiveKit SFU-compatible room interface.
- To use LiveKit Cloud Free / self-hosted LiveKit:
  ```env
  VITE_MEDIA_PROVIDER="livekit"
  VITE_LIVEKIT_URL="wss://your-livekit-project.livekit.cloud"
  ```
- Store `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` securely in Supabase Edge Function secrets or Cloud Secret Manager.

---

## 5. Daily 20-Minute Free Practice Rule

- Every student receives 20 minutes (1200 seconds) of free speaking practice per day.
- **Server Enforcement**: Counted based on active connected WebRTC session seconds. Stops when disconnected or on browser close.
- **Timezone**: Resets automatically at 00:00 midnight in **Asia/Dhaka** (`VITE_APP_TIMEZONE`).
- **Refreshing the page does not reset the timer**: Time usage is persisted per user per calendar date.
- **Admins can modify limits** anytime in the Admin Settings tab.

---

## 6. Testing Guide

1. **Student Speaking Practice**:
   - Navigate to `/practice`.
   - Click **Start Speaking Practice**.
   - The atomic matching engine finds an eligible online candidate and initiates a 15-second request.
   - Once connected, verify call timer, mute/unmute, camera toggle, and **Next Partner**.
   - Click **End Call** and observe that speaking duration is recorded towards today's limit.
2. **Mentor Live Classroom**:
   - Switch role to **Mentor (David)**.
   - Navigate to `/classes` and click **Host New Class** or enter the ongoing IELTS session.
   - Switch between **Mode A: Raise Hand Mode** and **Mode B: Open Discussion Mode**.
   - As a student, raise your hand; as a mentor, approve the student to grant microphone permission.
   - Test the **Mute All** control.
3. **Course Marketplace & bKash/Nagad Checkout**:
   - Navigate to `/courses`.
   - Click **View Syllabus & Enroll**.
   - Select **bKash** or **Nagad**, enter test credentials, and complete payment.
   - Verify that the lesson video player, progress bar, and PDF resources immediately unlock.
4. **Admin Console & Community Moderation**:
   - Switch role to **Admin (Tariq)**.
   - Navigate to `/admin`.
   - Test approving pending community member requests in the **Approval Queue**.
   - Adjust daily speaking limit in **Platform Settings**.

---

## 7. Known Free-Tier Limitations & Scaling Path

- **WebRTC Free STUN**: Free Google STUN nodes work across standard NATs. For strict symmetric enterprise NATs or cellular firewalls, deploy a Coturn instance or Cloudflare Calls TURN relay.
- **LiveKit Free Tier**: LiveKit Cloud free tier supports up to 50 concurrent participants. For 200 participants, provision a LiveKit Cloud paid instance or self-host LiveKit on an AWS c6g.2xlarge compute instance.
- **PostgreSQL Quota**: Supabase free tier includes 500MB database storage and 2GB bandwidth. For over 100+ daily online active users, upgrade to Supabase Pro ($25/mo).
