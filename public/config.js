// Configuration for Buzzer Quiz
// For production (Vercel): Add your Supabase credentials here
// For local dev: Create config.local.js (gitignored) which loads first

// Supabase Configuration (Optional - enables multi-device multiplayer)
// The anon key is safe to expose - it's designed for frontend use
// Supabase protects data with Row Level Security (RLS) policies

window.SUPABASE_URL = window.SUPABASE_URL || 'https://wivhfzszyuiisdmbsakm.supabase.co';
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdmhmenN6eXVpaXNkbWJzYWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyODI1MTUsImV4cCI6MjA3ODg1ODUxNX0.4htTQ_DLBveDib2xEBzO9wz7EctE-HmYuNDxSPAQ0cs';

// If both are empty, the app will use BroadcastChannel (same-browser only)

// Google Cloud Text-to-Speech Configuration (Optional - enables AI voices)
// To enable AI voices:
// 1. Go to https://console.cloud.google.com/apis/credentials
// 2. Create an API key with Text-to-Speech API enabled
// 3. Add GOOGLE_CLOUD_TTS_API_KEY to your Vercel environment variables
// 4. Restart the application
// The app will automatically enable the "Use AI Voice" toggle when configured
