# Vercel Deployment Troubleshooting

## Why Vercel Production Isn't Picking Up Changes

### Common Issues:

1. **Project Not Connected to GitHub**
   - Go to https://vercel.com/dashboard
   - Check if `icc-quiz-cards` project exists
   - If not, import it from GitHub

2. **Auto-Deployments Disabled**
   - In Vercel dashboard → Project Settings → Git
   - Ensure "Production Branch" is set to `main`
   - Check "Deploy Hooks" are enabled

3. **Environment Variables Missing**
   - Go to Project Settings → Environment Variables
   - Add:
     - `SUPABASE_URL` = `https://wivhfzszyuiisdmbsakm.supabase.co`
     - `SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **Important**: Redeploy after adding env vars

4. **Build Failing**
   - Check Vercel deployment logs
   - Look for errors in build output
   - Common issues:
     - Missing dependencies (check package.json)
     - Build script errors
     - File path issues

5. **Cache Issues**
   - Vercel might be serving cached version
   - Try "Redeploy" from Vercel dashboard
   - Or add `?v=timestamp` to URLs

## Quick Fix Steps:

1. **Verify Project Connection**:
   ```
   - Go to Vercel Dashboard
   - Check if project exists and is connected to GitHub
   ```

2. **Check Latest Deployment**:
   ```
   - Go to Deployments tab
   - Check if latest commit is deployed
   - Check build logs for errors
   ```

3. **Manual Redeploy**:
   ```
   - Click "Redeploy" on latest deployment
   - Or trigger new deployment from GitHub
   ```

4. **Verify Environment Variables**:
   ```
   - Project Settings → Environment Variables
   - Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set
   - Redeploy after adding/updating
   ```

5. **Check Build Configuration**:
   ```
   - Verify vercel.json exists
   - Check buildCommand is correct
   - Ensure scripts/build-config.js exists
   ```

## Testing Locally:

```bash
# Test build script
node scripts/build-config.js

# Check generated config
cat public/config.env.js

# Test with environment variables
SUPABASE_URL=test node scripts/build-config.js
```

## Force Redeploy:

1. Make a small change (add a comment)
2. Commit and push
3. Or use Vercel CLI: `vercel --prod`
