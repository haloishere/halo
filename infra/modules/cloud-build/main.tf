# ── Cloud Build Private Worker Pool ──────────────────────────────────────────
# Workers are peered to the project VPC, enabling direct access to private
# resources (Cloud SQL, etc.) during build steps like DB migrations.

resource "google_cloudbuild_worker_pool" "pool" {
  name     = "halo-pool-${var.environment}"
  location = var.region
  project  = var.project_id

  worker_config {
    disk_size_gb   = 100
    machine_type   = "e2-medium"
    no_external_ip = false # Workers need internet for pulling images
  }

  network_config {
    peered_network          = var.vpc_network_id
    peered_network_ip_range = "/29" # Smallest allocation (8 IPs)
  }
}

# Deploy SA must be able to schedule builds on the private pool.
# workerPoolUser = cloudbuild.workerPools.use (submit builds to pool)
# workerPoolOwner = cloudbuild.workerPools.{get,list,create,update,delete} (Terraform lifecycle)
# These are separate permission sets — both are required.
resource "google_project_iam_member" "deploy_worker_pool_user" {
  project = var.project_id
  role    = "roles/cloudbuild.workerPoolUser"
  member  = "serviceAccount:${var.deploy_service_account}"
}

resource "google_project_iam_member" "deploy_worker_pool_owner" {
  project = var.project_id
  role    = "roles/cloudbuild.workerPoolOwner"
  member  = "serviceAccount:${var.deploy_service_account}"
}

# ── Cloud Build Trigger (2nd gen) ────────────────────────────────────────────
# Triggers on tag push matching ^api-.*. Uses the GitHub connection created via
# Console and the public pool. Migrations run via Cloud Run Jobs (VPC access to Cloud SQL).

resource "google_cloudbuild_trigger" "api_deploy" {
  name     = "halo-api-deploy-${var.environment}"
  location = var.region
  project  = var.project_id

  repository_event_config {
    repository = "projects/${var.project_id}/locations/${var.region}/connections/${var.github_connection_name}/repositories/${var.github_repo_name}"

    push {
      tag = "^api-.*"
    }
  }

  filename = "cloudbuild.yaml"

  substitutions = {
    _ENVIRONMENT = var.environment
    _REGION      = var.region
  }

  service_account = "projects/${var.project_id}/serviceAccounts/${var.deploy_service_account}"

  include_build_logs = "INCLUDE_BUILD_LOGS_WITH_STATUS"
}

# ── CMS Cloud Build Trigger ─────────────────────────────────────────────────

resource "google_cloudbuild_trigger" "cms_deploy" {
  name     = "halo-cms-deploy-${var.environment}"
  location = var.region
  project  = var.project_id

  repository_event_config {
    repository = "projects/${var.project_id}/locations/${var.region}/connections/${var.github_connection_name}/repositories/${var.github_repo_name}"

    push {
      tag = "^cms-.*"
    }
  }

  filename = "cloudbuild-cms.yaml"

  substitutions = {
    _ENVIRONMENT = var.environment
    _REGION      = var.region
  }

  service_account = "projects/${var.project_id}/serviceAccounts/${var.deploy_service_account}"

  include_build_logs = "INCLUDE_BUILD_LOGS_WITH_STATUS"
}
