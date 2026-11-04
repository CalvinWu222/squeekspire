# Deployment status

- Target: https://squeekspire.com (www should redirect to apex).
- Repository: https://github.com/CalvinWu222/squeekspire — public, created; source push pending.
- Vercel URL: not created yet.
- Domain status: not configured in Vercel; Dynadot DNS and nameservers unchanged.
- API status: not deployed. Local build passed; 210 tests passed across 16 files, including bare `/api/leaderboard` returning 200 and both Redis environment variable formats.
- Local preparation: secret/private-key scan found no matches in 1,961 text files; exclusions cover dependencies, builds, environment files, Vercel files, logs, local data and secrets. Node is pinned to 22.x.
- Current step: preparing the initial push. Portable Git and Git Credential Manager were installed as local tooling after Edge downloads timed out. The repository is initialized on `main`, with 73 reviewed public project files staged. No credentials have been entered or recorded.
- Screenshots: `shots/deploy/github-repo.jpg`.
