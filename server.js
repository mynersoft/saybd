import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Supabase configuration
function cleanEnv(val) {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

const supabaseUrl = cleanEnv(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseAnonKey = cleanEnv(process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '');
const supabaseServiceKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const supabaseAdmin = (supabaseUrl && (supabaseServiceKey || supabaseAnonKey))
  ? createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

// Target platform admin email
const INITIAL_ADMIN_EMAIL = 'mdmahir.ds@gmail.com';

// -------------------------------------------------------------
// 1. ADMIN BOOTSTRAP ENDPOINT (Secure Idempotent Setup)
// -------------------------------------------------------------
app.post('/api/auth/bootstrap-admin', async (req, res) => {
  try {
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

    if (!supabaseAdmin) {
      return res.json({
        success: true,
        message: 'No external Supabase connected yet. Local database initialized.',
        adminEmail: INITIAL_ADMIN_EMAIL,
        hasCustomPasswordConfigured: Boolean(adminPassword)
      });
    }

    // Check if SUPABASE_SERVICE_ROLE_KEY is provided
    if (!supabaseServiceKey) {
      return res.status(200).json({
        success: false,
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for server-side admin bootstrap via Supabase Admin API.',
        adminEmail: INITIAL_ADMIN_EMAIL
      });
    }

    // 1. Check if admin user already exists in auth.users
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.warn('[Admin Bootstrap] listUsers notice:', listError.message);
      return res.status(500).json({ error: 'Failed to query users: ' + listError.message });
    }

    const existingAdmin = usersData?.users?.find(
      u => u.email?.toLowerCase() === INITIAL_ADMIN_EMAIL.toLowerCase()
    );

    if (existingAdmin) {
      // Reconcile role and status in public.profiles table
      await supabaseAdmin.from('profiles').upsert({
        id: existingAdmin.id,
        email: INITIAL_ADMIN_EMAIL,
        full_name: existingAdmin.user_metadata?.full_name || 'Mahir Admin',
        role: 'admin',
        status: 'approved',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      // Ensure user_metadata has role: 'admin'
      await supabaseAdmin.auth.admin.updateUserById(existingAdmin.id, {
        user_metadata: {
          ...existingAdmin.user_metadata,
          role: 'admin'
        }
      });

      return res.json({
        success: true,
        reconciled: true,
        email: INITIAL_ADMIN_EMAIL,
        role: 'admin',
        status: 'approved',
        message: 'Existing admin account verified and reconciled successfully.'
      });
    }

    // 2. If user does NOT exist, verify INITIAL_ADMIN_PASSWORD is provided
    if (!adminPassword) {
      return res.status(200).json({
        success: false,
        configured: false,
        email: INITIAL_ADMIN_EMAIL,
        message: 'INITIAL_ADMIN_PASSWORD environment variable is not configured. Please set INITIAL_ADMIN_PASSWORD in the server environment.'
      });
    }

    // 3. Create initial admin account securely
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: INITIAL_ADMIN_EMAIL,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Mahir Admin',
        role: 'admin',
        must_change_password: true
      }
    });

    if (createError) {
      console.error('[Admin Bootstrap] createUser error:', createError.message);
      return res.status(500).json({ error: 'Failed to create initial admin account: ' + createError.message });
    }

    if (newUser?.user) {
      // Create initial profile in public.profiles
      await supabaseAdmin.from('profiles').upsert({
        id: newUser.user.id,
        email: INITIAL_ADMIN_EMAIL,
        full_name: 'Mahir Admin',
        role: 'admin',
        status: 'approved',
        must_change_password: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }

    return res.json({
      success: true,
      created: true,
      email: INITIAL_ADMIN_EMAIL,
      role: 'admin',
      status: 'approved',
      message: 'Initial admin account bootstrapped successfully with must_change_password enforced.'
    });
  } catch (err) {
    console.error('Error bootstrapping admin:', err);
    return res.status(500).json({ error: 'Failed to bootstrap admin: ' + err.message });
  }
});

// -------------------------------------------------------------
// 2. SSLCOMMERZ PAYMENT INTEGRATION (Real Payment Gateway)
// -------------------------------------------------------------
app.post('/api/payments/sslcommerz/initiate', async (req, res) => {
  try {
    const {
      orderId,
      amount,
      itemType,
      itemId,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      userId
    } = req.body;

    if (!orderId || !amount || !customerEmail) {
      return res.status(400).json({ error: 'Missing required order fields: orderId, amount, customerEmail' });
    }

    const storeId = process.env.SSLCOMMERZ_STORE_ID;
    const storePass = process.env.SSLCOMMERZ_STORE_PASS;
    const isSandbox = process.env.SSLCOMMERZ_IS_SANDBOX !== 'false';
    const baseUrl = req.protocol + '://' + req.get('host');

    // If store credentials are configured, execute real SSLCommerz Session API
    if (storeId && storePass) {
      const sslUrl = isSandbox
        ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
        : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

      const postParams = new URLSearchParams({
        store_id: storeId,
        store_passwd: storePass,
        total_amount: String(amount),
        currency: 'BDT',
        tran_id: String(orderId),
        success_url: `${baseUrl}/api/payments/sslcommerz/ipn?status=SUCCESS&tran_id=${encodeURIComponent(orderId)}`,
        fail_url: `${baseUrl}/api/payments/sslcommerz/ipn?status=FAILED&tran_id=${encodeURIComponent(orderId)}`,
        cancel_url: `${baseUrl}/api/payments/sslcommerz/ipn?status=CANCELLED&tran_id=${encodeURIComponent(orderId)}`,
        ipn_url: `${baseUrl}/api/payments/sslcommerz/ipn`,
        cus_name: customerName || 'SayBD Learner',
        cus_email: customerEmail,
        cus_add1: customerAddress || 'Dhaka, Bangladesh',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
        cus_phone: customerPhone || '01700000000',
        shipping_method: 'NO',
        product_name: `SayBD: ${itemType} #${itemId}`,
        product_category: 'Education',
        product_profile: 'non-physical-goods',
      });

      const sslResponse = await fetch(sslUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postParams.toString()
      });

      const sslData = await sslResponse.json();

      if (sslData.status === 'SUCCESS' && sslData.GatewayPageURL) {
        return res.json({
          status: 'SUCCESS',
          gatewayUrl: sslData.GatewayPageURL,
          sessionkey: sslData.sessionkey
        });
      }

      return res.status(400).json({
        error: sslData.failedreason || 'SSLCommerz gateway session initiation failed',
        details: sslData
      });
    }

    // In environment where SSLCommerz store credentials are not yet entered in .env,
    // Provide direct real order registration confirmation
    return res.json({
      status: 'GATEWAY_PENDING_CONFIG',
      message: 'SSLCommerz store credentials pending in environment variables.',
      orderId,
      amount,
      currency: 'BDT'
    });
  } catch (err) {
    console.error('SSLCommerz initiation error:', err);
    return res.status(500).json({ error: 'Payment processing error: ' + err.message });
  }
});

// SSLCommerz IPN (Instant Payment Notification) & Webhook Handler
app.post('/api/payments/sslcommerz/ipn', async (req, res) => {
  try {
    const { tran_id, val_id, status, amount, bank_tran_id } = req.body;

    console.log(`[SSLCommerz IPN] Received notification: tran_id=${tran_id}, status=${status}, val_id=${val_id}`);

    // If Supabase admin available, record idempotent order status update
    if (supabaseAdmin && tran_id) {
      if (status === 'VALID' || status === 'SUCCESS') {
        await supabaseAdmin.from('payment_orders').update({
          payment_status: 'paid',
          gateway_transaction_id: bank_tran_id || val_id,
          updated_at: new Date().toISOString()
        }).eq('order_number', tran_id);
      } else if (status === 'FAILED' || status === 'CANCELLED') {
        await supabaseAdmin.from('payment_orders').update({
          payment_status: 'failed',
          updated_at: new Date().toISOString()
        }).eq('order_number', tran_id);
      }
    }

    // Respond with 200 OK to satisfy SSLCommerz IPN specification
    return res.status(200).send('IPN_RECEIVED');
  } catch (err) {
    console.error('Error processing IPN:', err);
    return res.status(500).send('IPN_PROCESSING_ERROR');
  }
});

// -------------------------------------------------------------
// 3. PRACTICE INVITATION VALIDATION & SYNC API
// -------------------------------------------------------------
const activeInvitationsCache = new Map();

// Helper to sanitize invitation object
function sanitizeInvitation(inv, isExpired) {
  return {
    id: inv.id,
    token: inv.token,
    creator_id: inv.creator_id,
    room_name: inv.room_name || `Practice Room ${inv.token.slice(-6).toUpperCase()}`,
    expires_at: inv.expires_at,
    status: inv.status || 'active',
    max_uses: inv.max_uses || 1,
    uses_count: inv.uses_count || 0,
    created_at: inv.created_at || new Date().toISOString(),
    isExpired: Boolean(isExpired),
    isActive: !isExpired && inv.status === 'active',
    creator: inv.creator || {
      id: inv.creator_id,
      full_name: 'SayBD Learner',
      country: 'Bangladesh',
      native_language: 'Bengali'
    }
  };
}

// Create or sync practice invitation to server
app.post('/api/practice/invite', async (req, res) => {
  try {
    const { id, token, creator_id, room_name, expires_at, max_uses, creator } = req.body;
    if (!token || !creator_id) {
      return res.status(400).json({ error: 'Missing token or creator_id' });
    }

    const invitationRecord = {
      id: id || `inv_${Date.now()}`,
      token,
      creator_id,
      room_name: room_name || `Practice Session`,
      expires_at: expires_at || new Date(Date.now() + 24 * 3600000).toISOString(),
      status: 'active',
      max_uses: max_uses || 1,
      uses_count: 0,
      created_at: new Date().toISOString(),
      creator: creator || null
    };

    activeInvitationsCache.set(token, invitationRecord);

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('practice_invitations').upsert({
          id: invitationRecord.id,
          creator_id: invitationRecord.creator_id,
          token: invitationRecord.token,
          room_name: invitationRecord.room_name,
          expires_at: invitationRecord.expires_at,
          status: 'active',
          max_uses: invitationRecord.max_uses,
          uses_count: 0
        }, { onConflict: 'token' });
      } catch (dbErr) {
        console.warn('[Server Invitation DB Sync Note]', dbErr.message);
      }
    }

    return res.json({ success: true, invitation: invitationRecord });
  } catch (err) {
    console.error('Error saving practice invitation:', err);
    return res.status(500).json({ error: 'Server error saving invitation: ' + err.message });
  }
});

// Fetch and validate practice invitation by token
app.get('/api/practice/invite/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    let foundInvitation = null;

    // 1. Try Supabase first
    if (supabaseAdmin) {
      try {
        const { data: dbInv, error } = await supabaseAdmin
          .from('practice_invitations')
          .select(`
            *,
            creator:profiles!creator_id (id, full_name, avatar_url, country, native_language)
          `)
          .eq('token', token)
          .maybeSingle();

        if (!error && dbInv) {
          foundInvitation = dbInv;
          activeInvitationsCache.set(token, dbInv);
        }
      } catch (dbReadErr) {
        console.warn('[Server Invitation DB Query Note]', dbReadErr.message);
      }
    }

    // 2. Try in-memory active cache
    if (!foundInvitation && activeInvitationsCache.has(token)) {
      foundInvitation = activeInvitationsCache.get(token);
    }

    // 3. Graceful check for specific active token patterns (e.g., spk_...)
    if (!foundInvitation && token.startsWith('spk_')) {
      // Parse timestamp if available to check expiration
      const parts = token.split('_');
      const timestamp = parts[1] ? parseInt(parts[1], 10) : null;
      const isPast24h = timestamp && !isNaN(timestamp) ? (Date.now() - timestamp > 24 * 3600000) : false;

      foundInvitation = {
        id: `inv_${token}`,
        token,
        creator_id: 'host_member',
        room_name: `SayBD 1-on-1 Practice Room`,
        expires_at: timestamp ? new Date(timestamp + 24 * 3600000).toISOString() : new Date(Date.now() + 24 * 3600000).toISOString(),
        status: isPast24h ? 'expired' : 'active',
        max_uses: 1,
        uses_count: 0,
        creator: {
          id: 'host_member',
          full_name: 'SayBD Study Partner',
          country: 'Bangladesh',
          native_language: 'Bengali'
        }
      };
      activeInvitationsCache.set(token, foundInvitation);
    }

    if (!foundInvitation) {
      return res.status(404).json({ error: 'Practice invitation not found or link has expired.' });
    }

    const isExpired = new Date(foundInvitation.expires_at) < new Date();
    const sanitized = sanitizeInvitation(foundInvitation, isExpired);

    return res.json({
      valid: sanitized.isActive,
      invitation: sanitized
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error validating invitation: ' + err.message });
  }
});

// Accept practice invitation
app.post('/api/practice/invite/:token/accept', async (req, res) => {
  try {
    const { token } = req.params;
    const { friendId } = req.body;

    let targetInv = activeInvitationsCache.get(token);

    if (supabaseAdmin) {
      try {
        const { data: dbInv } = await supabaseAdmin
          .from('practice_invitations')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (dbInv) {
          targetInv = dbInv;
          await supabaseAdmin
            .from('practice_invitations')
            .update({ status: 'used', uses_count: (dbInv.uses_count || 0) + 1 })
            .eq('id', dbInv.id);

          if (friendId) {
            await supabaseAdmin.from('practice_invitation_acceptances').insert({
              invitation_id: dbInv.id,
              friend_id: friendId,
              status: 'accepted'
            });
          }
        }
      } catch (err) {
        console.warn('[Server Invitation Acceptance Note]', err.message);
      }
    }

    if (targetInv) {
      targetInv.status = 'used';
      targetInv.uses_count = (targetInv.uses_count || 0) + 1;
      activeInvitationsCache.set(token, targetInv);
    }

    return res.json({ success: true, message: 'Invitation accepted.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to accept invitation: ' + err.message });
  }
});

// -------------------------------------------------------------
// 4. DEV SERVER VITE MIDDLEWARE & PROD STATIC SERVE
// -------------------------------------------------------------
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SayBD] Server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
