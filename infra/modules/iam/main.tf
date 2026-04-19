# ── Service Accounts ─────────────────────────────────────────────────────────

resource "google_service_account" "api" {
  account_id   = "halo-api-${var.environment}"
  display_name = "Halo API Runtime (${var.environment})"
  project      = var.project_id
}

resource "google_service_account" "deploy" {
  account_id   = "halo-deploy-${var.environment}"
  display_name = "Halo CI/CD Deploy (${var.environment})"
  project      = var.project_id
}

# ── API Runtime Roles ─────────────────────────────────────────────────────────

resource "google_project_iam_member" "api_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_kms" {
  project = var.project_id
  role    = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# createCustomToken() signs JWTs via IAM signBlob API (no JSON key on Cloud Run).
resource "google_project_iam_member" "api_token_creator" {
  project = var.project_id
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# TODO(step-3): Scope to specific model/region once the AI service module is implemented.
# roles/aiplatform.user is project-wide — grants access to all Vertex AI resources.
# When the AI module adds a specific endpoint, replace with a resource-level binding.
resource "google_project_iam_member" "api_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# ── Deploy Roles ──────────────────────────────────────────────────────────────

resource "google_project_iam_member" "deploy_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_service_account_iam_member" "deploy_acts_as_api" {
  service_account_id = google_service_account.api.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

# Deploy SA must also act as itself when used as the Cloud Build --service-account.
# GCP does not grant implicit self-impersonation — actAs must be explicitly bound.
resource "google_service_account_iam_member" "deploy_acts_as_self" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

# Deploy SA can push images to Artifact Registry (halo repository only)
resource "google_artifact_registry_repository_iam_member" "deploy_artifact_push" {
  project    = var.project_id
  location   = var.region
  repository = "halo"
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deploy.email}"
}

# Deploy SA reads DATABASE_URL from Secret Manager during Cloud Build migration step.
# Scoped to the specific secret — not project-wide (least-privilege).
resource "google_secret_manager_secret_iam_member" "deploy_database_url" {
  project   = var.project_id
  secret_id = var.database_url_secret_name
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.deploy.email}"
}

# Deploy SA submits Cloud Builds (gcloud builds submit --service-account in api-deploy.yml).
resource "google_project_iam_member" "deploy_cloudbuild" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.editor"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Required by gcloud CLI for any API call — cloudbuild.builds.editor alone is insufficient.
# Without this, gcloud builds submit fails with "forbidden from accessing the bucket" error.
resource "google_project_iam_member" "deploy_service_usage" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageConsumer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Cloud Build writes build logs to Cloud Logging (cloudbuild.yaml: logging: CLOUD_LOGGING_ONLY).
resource "google_project_iam_member" "deploy_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Pre-create Cloud Build's staging bucket so the IAM binding doesn't race with the first build run.
resource "google_storage_bucket" "cloudbuild" {
  name                        = "${var.project_id}_cloudbuild"
  project                     = var.project_id
  location                    = "US"
  uniform_bucket_level_access = true
  force_destroy               = false
}

# gcloud builds submit uploads source tarball to the default Cloud Build staging bucket.
# Scoped to the specific bucket — not project-wide storage access.
resource "google_storage_bucket_iam_member" "deploy_cloudbuild_bucket" {
  bucket = google_storage_bucket.cloudbuild.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.deploy.email}"
}

# ── Custom Role: Deploy Terraform Reader (replaces roles/viewer + roles/iam.securityReviewer)
# Grants read-only permissions for every resource type in this project's TF state,
# enabling terraform plan to refresh state without mutation capability.
resource "google_project_iam_custom_role" "deploy_iam_reader" {
  role_id     = "haloDeployIamReader${title(var.environment)}"
  title       = "Halo Deploy Terraform Reader (${var.environment})"
  description = "Read-only permissions for terraform plan state refresh"
  project     = var.project_id
  permissions = [
    # IAM — service accounts, custom roles, WIF pools
    "iam.serviceAccounts.get",
    "iam.serviceAccounts.getIamPolicy",
    "iam.roles.get",
    "iam.workloadIdentityPools.get",
    "iam.workloadIdentityPoolProviders.get",
    "resourcemanager.projects.getIamPolicy",
    # Secret Manager — metadata only, NOT secretAccessor (no value reads)
    "secretmanager.secrets.get",
    "secretmanager.secrets.getIamPolicy",
    "secretmanager.versions.get",
    "secretmanager.versions.list",
    # Cloud Run (services + domain mappings)
    "run.services.get",
    "run.services.getIamPolicy",
    "run.domainmappings.get",
    "run.domainmappings.list",
    # Artifact Registry
    "artifactregistry.repositories.get",
    "artifactregistry.repositories.getIamPolicy",
    # Cloud KMS
    "cloudkms.cryptoKeys.get",
    "cloudkms.cryptoKeys.getIamPolicy",
    "cloudkms.keyRings.get",
    "cloudkms.keyRings.getIamPolicy",
    # Cloud SQL
    "cloudsql.instances.get",
    "cloudsql.databases.get",
    "cloudsql.databases.list",
    "cloudsql.users.list",
    # Compute / VPC
    "compute.globalAddresses.get",
    "compute.networks.get",
    "compute.routers.get",
    "compute.securityPolicies.get",
    "compute.subnetworks.get",
    "vpcaccess.connectors.get",
    # Service Networking (VPC peering)
    "servicenetworking.services.get",
    # Monitoring / Logging
    "monitoring.alertPolicies.get",
    "monitoring.uptimeCheckConfigs.get",
    "logging.logMetrics.get",
    "logging.sinks.get",
    # Cloud Scheduler
    "cloudscheduler.jobs.get",
    # Cloud Run Jobs
    "run.jobs.get",
    "run.jobs.getIamPolicy",
  ]
}

resource "google_project_iam_member" "deploy_iam_reader" {
  project = var.project_id
  role    = google_project_iam_custom_role.deploy_iam_reader.id
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# ── Custom Role: Deploy Terraform Writer ─────────────────────────────────────
# Write permissions for terraform apply — secrets, scheduler, and custom role
# management. Separated from the reader role to maintain clear read/write split.
# BOOTSTRAP: When adding new resource types, apply locally with admin creds first
# to grant the deploy SA permission to manage the new resources.
resource "google_project_iam_custom_role" "deploy_terraform_writer" {
  role_id     = "haloDeployTerraformWriter${title(var.environment)}"
  title       = "Halo Deploy Terraform Writer (${var.environment})"
  description = "Write permissions for terraform apply (secrets, scheduler, custom roles)"
  project     = var.project_id
  permissions = [
    # Secret Manager — create and manage secrets + versions + IAM
    "secretmanager.secrets.create",
    "secretmanager.secrets.update",
    "secretmanager.secrets.delete",
    "secretmanager.secrets.setIamPolicy",
    "secretmanager.versions.add",
    "secretmanager.versions.destroy",
    "secretmanager.versions.enable",
    "secretmanager.versions.disable",
    # IAM — manage custom roles, service accounts, and project-level IAM bindings
    "iam.roles.update",
    "iam.serviceAccounts.create",
    "iam.serviceAccounts.delete",
    "iam.serviceAccounts.update",
    "iam.serviceAccounts.setIamPolicy",
    "resourcemanager.projects.setIamPolicy",
    # Cloud Scheduler — manage scheduler jobs
    "cloudscheduler.jobs.create",
    "cloudscheduler.jobs.update",
    "cloudscheduler.jobs.delete",
    "cloudscheduler.jobs.enable",
    "cloudscheduler.jobs.pause",
    # Cloud Run Jobs — update image after deploy
    "run.jobs.update",
    # Storage — create buckets (e.g. CMS media bucket)
    "storage.buckets.create",
    "storage.buckets.update",
    "storage.buckets.setIamPolicy",
    # Compute / VPC — Cloud NAT config is embedded in the router AND registered
    # on the network; both parents must allow updates to mutate NAT settings
    # (e.g. tuning minPortsPerVm, endpoint-independent mapping).
    "compute.routers.update",
    "compute.networks.updatePolicy",
  ]
}

resource "google_project_iam_member" "deploy_terraform_writer" {
  project = var.project_id
  role    = google_project_iam_custom_role.deploy_terraform_writer.id
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# ── Custom Role: Deploy Storage Reader (replaces roles/storage.admin) ────────
# Grants only GCS bucket read + IAM read for terraform plan. NO object write/delete.
resource "google_project_iam_custom_role" "deploy_storage_reader" {
  role_id     = "haloDeployStorageReader${title(var.environment)}"
  title       = "Halo Deploy Storage Reader (${var.environment})"
  description = "Minimal GCS permissions for terraform plan state refresh"
  project     = var.project_id
  permissions = [
    "storage.buckets.get",
    "storage.buckets.getIamPolicy",
    "storage.buckets.list",
  ]
}

resource "google_project_iam_member" "deploy_storage_reader" {
  project = var.project_id
  role    = google_project_iam_custom_role.deploy_storage_reader.id
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# ── Custom Role: Media Operator (NO delete permission) ────────────────────────

resource "google_project_iam_custom_role" "media_operator" {
  role_id     = "haloMediaOperator${title(var.environment)}"
  title       = "Halo Media Operator (${var.environment})"
  description = "Can read, list, create, and update media objects. Cannot delete."
  project     = var.project_id

  permissions = [
    "storage.objects.get",
    "storage.objects.list",
    "storage.objects.create",
    "storage.objects.update",
    # Intentionally NO storage.objects.delete
  ]
}

resource "google_storage_bucket_iam_member" "api_media" {
  bucket = var.media_bucket_name
  role   = google_project_iam_custom_role.media_operator.id
  member = "serviceAccount:${google_service_account.api.email}"
}

# API needs read access to CMS media bucket for signed URL generation
resource "google_storage_bucket_iam_member" "api_cms_media_read" {
  bucket = var.cms_media_bucket_name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.api.email}"
}

# ── CMS Service Account ──────────────────────────────────────────────────────

resource "google_service_account" "cms" {
  account_id   = "halo-cms-${var.environment}"
  display_name = "Halo CMS Runtime (${var.environment})"
  project      = var.project_id
}

resource "google_project_iam_member" "cms_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cms.email}"
}

resource "google_storage_bucket_iam_member" "cms_media" {
  bucket = var.cms_media_bucket_name
  role   = google_project_iam_custom_role.media_operator.id
  member = "serviceAccount:${google_service_account.cms.email}"
}

# Deploy SA needs actAs on the CMS SA to deploy the Cloud Run service
resource "google_service_account_iam_member" "deploy_acts_as_cms" {
  service_account_id = google_service_account.cms.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

# ── Cross-Project Firebase Auth ───────────────────────────────────────────────
# The API creates Firebase users (createUser), looks them up (getUserByEmail),
# and mints custom tokens (createCustomToken) during OTP verification.
# firebaseauth.admin is required — viewer only allows verifyIdToken.

resource "google_project_iam_member" "api_firebase_auth" {
  count   = var.firebase_project_id != "" ? 1 : 0
  project = var.firebase_project_id
  role    = "roles/firebaseauth.admin"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# createCustomToken() signs JWTs as the Firebase project's admin SDK SA.
# Cloud Run SA (different project) needs serviceAccountTokenCreator on the Firebase SA
# to impersonate it via signBlob, avoiding auth/custom-token-mismatch.
resource "google_service_account_iam_member" "api_signs_as_firebase_sa" {
  count              = var.firebase_project_id != "" ? 1 : 0
  service_account_id = "projects/${var.firebase_project_id}/serviceAccounts/firebase-adminsdk-fbsvc@${var.firebase_project_id}.iam.gserviceaccount.com"
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.api.email}"
}

# Deploy SA reads Firebase project IAM policy during terraform plan (state refresh).
# roles/browser is the minimal predefined role with resourcemanager.projects.getIamPolicy.
resource "google_project_iam_member" "deploy_firebase_reader" {
  count   = var.firebase_project_id != "" ? 1 : 0
  project = var.firebase_project_id
  role    = "roles/browser"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# ── Workload Identity Federation ──────────────────────────────────────────────

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool-${var.environment}"
  project                   = var.project_id
  display_name              = "GitHub Actions Pool (${var.environment})"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  project                            = var.project_id
  display_name                       = "GitHub OIDC Provider"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.actor"            = "assertion.actor"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
  }

  # Repo-level restriction — only this specific repository can authenticate
  attribute_condition = "assertion.repository == '${var.github_org}/${var.github_repo}' && assertion.repository_owner == '${var.github_org}'"
}

resource "google_service_account_iam_member" "deploy_wif_binding" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_org}/${var.github_repo}"
}
