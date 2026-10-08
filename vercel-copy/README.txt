Renewal Addendum Generator — Password-protected Vercel copy

The original localhost generator is unchanged. This copy requires a server-side password.

UPDATE YOUR EXISTING GITHUB REPOSITORY
1. In vercel-copy, replace vercel.json with this copy's vercel.json.
2. Upload the api and site folders inside vercel-copy.
3. Remove the old public folder from the GitHub Vercel copy (do not remove the localhost files).
The explicit build configuration publishes only the gateway function. No app files are public static assets.

VERCEL SETTINGS
Root Directory: vercel-copy (for your existing repository)
This configuration uses an explicit function build; the old Output Directory/public override is no longer used.
In Settings > Environment Variables, add:
Name: RENEWAL_PASSWORD
Value: your own strong password, at least 12 characters (use a unique randomly generated password).
Select Production and Preview, and mark the variable Sensitive if available.
Enter the password only in Vercel, never in GitHub or the HTML/JavaScript files.
Redeploy after uploading the copy and adding the variable.
If the variable is absent or too short, the site stays locked.

Test the production URL in an incognito window. It must show the login page.
Test /app.js and /pricing-data.js without signing in; they must be blocked.
Only share the link and password through your approved team channel.
Sign-in lasts eight hours; Sign out clears the session.
Changing RENEWAL_PASSWORD and redeploying invalidates previous sessions on that deployment.
Historical deployments use their own environment values; remove any older unprotected deployments if their URLs must no longer be accessible.
If you want the source files to be private as well, make the existing public GitHub repository private.

No paid password-protection upgrade is required. Normal Vercel function usage and account limits still apply.
This copy has not been uploaded or deployed by Codex.
