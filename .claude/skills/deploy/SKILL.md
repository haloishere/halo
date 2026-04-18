---
name: deploy
description: Tag-based deployment for API, CMS, and mobile services. Creates semver git tags to trigger Cloud Build (API/CMS) or GitHub Actions EAS (mobile) builds.
---

# Deploy (Tag-Based)

Deploys are triggered by pushing git tags. No branch push triggers any deployment. This skill handles versioning, tagging, and monitoring the resulting build.

**Tag patterns:**
- `api-v<semver>` → triggers `cloudbuild.yaml` (API deploy to Cloud Run staging)
- `cms-v<semver>` → triggers `cloudbuild-cms.yaml` (CMS deploy to Cloud Run staging)
- `mobile-v<semver>` → triggers `.github/workflows/mobile-build.yml` (EAS preview APK build via GitHub Actions)

---

## Step 1 — Determine Next Version

Check existing tags to find the latest version for the target service:

```bash
# For API
git tag -l "api-v*" --sort=-v:refname | head -5

# For CMS
git tag -l "cms-v*" --sort=-v:refname | head -5

# For Mobile (EAS preview APK)
git tag -l "mobile-v*" --sort=-v:refname | head -5
```

If no tags exist yet, start at `v0.1.0`.

Bump rules (semver):
- **patch** (default): bug fixes, small changes → `v0.1.0` → `v0.1.1`
- **minor**: new features, non-breaking changes → `v0.1.0` → `v0.2.0`
- **major**: breaking changes → `v0.1.0` → `v1.0.0`

Ask the user which bump type if not specified.

---

## Step 2 — Verify Before Tagging

Before creating any tag, confirm:

1. **Working tree is clean** — no uncommitted changes
2. **Current commit is what the user wants to deploy** — show `git log --oneline -1`
3. **The service's code actually changed** — show recent commits touching the relevant paths:

```bash
# API changes since last API tag (falls back to full log if no tags exist)
LAST_API_TAG=$(git tag -l "api-v*" --sort=-v:refname | head -1)
git log ${LAST_API_TAG:+$LAST_API_TAG..}HEAD --oneline -- apps/api/ packages/shared/

# CMS changes since last CMS tag
LAST_CMS_TAG=$(git tag -l "cms-v*" --sort=-v:refname | head -1)
git log ${LAST_CMS_TAG:+$LAST_CMS_TAG..}HEAD --oneline -- apps/cms/ packages/shared/

# Mobile changes since last mobile tag
LAST_MOBILE_TAG=$(git tag -l "mobile-v*" --sort=-v:refname | head -1)
git log ${LAST_MOBILE_TAG:+$LAST_MOBILE_TAG..}HEAD --oneline -- apps/mobile/ packages/shared/
```

If no changes exist for the target service, warn the user and ask to confirm.

---

## Step 3 — Create and Push Tag

```bash
# Create annotated tag (example for API)
git tag -a api-v0.1.0 -m "API v0.1.0: <brief description>"

# Push the tag (this triggers Cloud Build)
git push origin api-v0.1.0
```

Always use **annotated tags** (`-a`) with a message. The message should summarize what's being deployed.

**IMPORTANT**: Pushing the tag triggers the Cloud Build immediately. Confirm with the user before `git push origin <tag>`.

---

## Step 4 — Monitor Cloud Build

After pushing the tag, check the build status:

```bash
# List recent builds
gcloud builds list --region=us-central1 --project=halo-488214 --limit=3 --format="table(id,status,createTime,substitutions._ENVIRONMENT)"

# Stream logs for the latest build
gcloud builds log $(gcloud builds list --region=us-central1 --project=halo-488214 --limit=1 --format="value(id)") --region=us-central1 --project=halo-488214 --stream
```

### Build Pipeline (API — `cloudbuild.yaml`)
1. Build Docker image
2. Push to Artifact Registry
3. Run DB migrations (Cloud Run Job)
4. Deploy canary (0% traffic)
5. Health check (`/livez`)
6. Promote to 100% traffic
7. Update tips generation job image

### Build Pipeline (CMS — `cloudbuild-cms.yaml`)
1. Build Docker image
2. Push to Artifact Registry
3. Deploy canary (0% traffic) — Payload auto-migrates on startup
4. Health check (`/api/access`)
5. Promote to 100% traffic

### Build Pipeline (Mobile — `.github/workflows/mobile-build.yml`)
1. `test` job: install deps, typecheck, run Vitest unit tests (500+ tests, ~3min)
2. `build-preview` job (gated on `mobile-v*` tag): setup EAS, run `eas build --profile preview --platform android` which produces an internal-distribution APK uploaded to Expo
- Monitor the EAS build via: `npx eas-cli build:list --limit 3 --json`
- Download the APK from the Expo dashboard or via the EAS CLI after completion

---

## Step 5 — Verify Deployment

After build succeeds:

```bash
# API health
curl -sf https://api-staging.haloapp.tech/livez

# CMS health
curl -sf https://panel.haloapp.tech/api/access

# Mobile: no runtime health check — install the preview APK from the Expo
# dashboard and smoke-test the relevant flow manually.
```

---

## Rollback

If a deploy goes wrong after promotion, use the GitHub Actions rollback workflow (`.github/workflows/rollback.yml`). **Do NOT run gcloud mutations directly** — all infra changes must go through workflows for audit trail and proper auth.

```bash
# Trigger rollback via GitHub CLI
gh workflow run rollback.yml -f service=halo-api-staging -f environment=staging
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| Deploy API | `git tag -a api-v0.X.X -m "msg" && git push origin api-v0.X.X` |
| Deploy CMS | `git tag -a cms-v0.X.X -m "msg" && git push origin cms-v0.X.X` |
| Build Mobile preview APK | `git tag -a mobile-v0.X.X -m "msg" && git push origin mobile-v0.X.X` |
| List API tags | `git tag -l "api-v*" --sort=-v:refname` |
| List CMS tags | `git tag -l "cms-v*" --sort=-v:refname` |
| List Mobile tags | `git tag -l "mobile-v*" --sort=-v:refname` |
| Delete local tag | `git tag -d api-v0.X.X` |
| Delete remote tag | `git push origin --delete api-v0.X.X` |
| Watch Cloud Build (API/CMS) | `gcloud builds list --region=us-central1 --project=halo-488214 --limit=3` |
| Watch Mobile build (GHA) | `gh run list --workflow "Mobile Build" --limit 3` |
| Watch EAS job | `npx eas-cli build:list --limit 3` |
