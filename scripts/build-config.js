// Build script to inject Vercel environment variables into config
const fs = require('fs');
const path = require('path');

// Get environment variables from Vercel (or use defaults)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const configContent = `// Auto-generated config from Vercel environment variables
// This file is generated during build - do not edit manually
window.SUPABASE_URL = '${supabaseUrl}';
window.SUPABASE_ANON_KEY = '${supabaseKey}';
`;

const configPath = path.join(__dirname, '../public/config.env.js');
fs.writeFileSync(configPath, configContent);

console.log('✅ Config file generated from environment variables');
console.log(`   SUPABASE_URL: ${supabaseUrl ? 'Set' : 'Not set'}`);
console.log(`   SUPABASE_ANON_KEY: ${supabaseKey ? 'Set' : 'Not set'}`);
