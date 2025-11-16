# Supabase Setup Guide

Enable real multi-device multiplayer for your ICC Quiz Cards app using Supabase's free tier.

## Why Supabase?

- **100% Free Tier**: Up to 500MB database, 2GB bandwidth, 50K monthly active users
- **Real-time Support**: Built-in WebSocket connections
- **Easy Setup**: 5 minutes to get started
- **No Credit Card**: Free tier doesn't require payment info
- **Scalable**: Upgrade when you need more

## Setup Steps

### 1. Create Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub, Google, or email (no credit card needed)

### 2. Create a New Project

1. Click "New Project"
2. Choose your organization (or create one)
3. Fill in:
   - **Name**: `icc-quiz-cards` (or any name you like)
   - **Database Password**: Generate a strong password (save it somewhere safe)
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait 1-2 minutes for project to initialize

### 3. Get Your Credentials

1. Go to **Settings** (gear icon in sidebar)
2. Click **API** in the Configuration section
3. You'll see two important values:

   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

4. **Copy both values** - you'll need them in the next step

⚠️ **Note**: The `anon` key is safe to use in frontend code. It's designed for public access.

### 4. Configure Your App

You have **two options**:

#### Option A: Local Development (Recommended)

1. Create a file `public/config.local.js` (this file is gitignored)
2. Paste your credentials:

```javascript
// public/config.local.js
window.SUPABASE_URL = 'https://xxxxxxxxxxxxx.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

3. **Never commit this file to Git!** (it's already in .gitignore)

#### Option B: Vercel Environment Variables (Production)

1. Go to your Vercel project dashboard
2. Click **Settings** > **Environment Variables**
3. Add two variables:

   - `SUPABASE_URL` = `https://xxxxxxxxxxxxx.supabase.co`
   - `SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

4. Update `public/config.js` to read from environment:

```javascript
// public/config.js
window.SUPABASE_URL = process.env.SUPABASE_URL || '';
window.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
```

5. Redeploy your app

### 5. Enable Realtime (Required!)

1. In Supabase Dashboard, go to **Database** > **Replication**
2. Scroll to "Realtime" section
3. Toggle on **Enable Realtime** for `public` schema
4. Click **Save**

This allows the multiplayer to sync in real-time!

### 6. Test Your Setup

1. Open your app: `http://localhost:8000/multiplayer.html` or your Vercel URL
2. Check browser console - you should see:
   ```
   ✓ Using Supabase for multiplayer (multi-device support)
   ```
3. Try opening the same room code on:
   - Different browser (Chrome + Firefox)
   - Different device (phone + computer)
   - Different networks (WiFi + mobile data)

4. All devices should sync in real-time!

## Troubleshooting

### "Local Mode (Same browser only)" shows instead of Supabase

**Check:**
- Is `config.local.js` or `config.js` loaded?
- Open browser console (F12) - any errors?
- Are credentials correct (copy-paste from Supabase dashboard)?

### Connection works but messages don't sync

**Check:**
- Is Realtime enabled? (Step 5 above)
- Browser console errors?
- Internet connection stable?

### "Failed to connect to Supabase"

**Check:**
- Project URL correct (should start with `https://`)
- Anon key copied completely (it's very long!)
- Supabase project is running (green status in dashboard)

### Still using BroadcastChannel

The app automatically falls back to BroadcastChannel if:
- No Supabase credentials configured
- Supabase connection fails
- You're testing locally without config

This is intentional! You can still test locally with multiple browser tabs.

## Security Notes

✅ **Safe to commit**:
- `public/config.js` (template with empty strings)
- All other files

❌ **Never commit**:
- `public/config.local.js` (your actual credentials)
- `.env` files

The `anon` key is designed for frontend use and has limited permissions. For production apps with authentication, you'd use Row Level Security (RLS) policies in Supabase.

## Free Tier Limits

Supabase free tier includes:
- **500MB** database storage
- **2GB** bandwidth per month
- **50K** monthly active users
- **500MB** file storage
- Unlimited API requests

For a quiz app with 4-5 players per game:
- ~1KB per message
- ~100 messages per 10-minute game
- Can support **thousands of games per month** on free tier!

## Upgrading

If you outgrow free tier:
- **Pro**: $25/month - 8GB database, 50GB bandwidth, 100K users
- Pay-as-you-go for additional usage
- No forced upgrade - app keeps working on free tier

## Alternative: Use Environment Variables Only

For better security in production, use only environment variables:

```bash
# .env.local (for local development)
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Then update your build process to inject these into config.js during deployment.

## Questions?

- **Supabase Docs**: https://supabase.com/docs
- **Realtime Docs**: https://supabase.com/docs/guides/realtime
- **Community**: https://github.com/supabase/supabase/discussions
