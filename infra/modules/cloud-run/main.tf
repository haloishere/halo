resource "google_artifact_registry_repository" "halo" {
  location      = var.region
  repository_id = "halo"
  description   = "Halo API Docker images"
  format        = "DOCKER"
  project       = var.project_id
}

resource "google_cloud_run_v2_service" "api" {
  name     = "halo-api-${var.environment}"
  location = var.region
  project  = var.project_id

  ingress = "INGRESS_TRAFFIC_ALL"

  # Image is deployed by api-deploy.yml (gcloud run deploy), not Terraform.
  # Without this, terraform apply reverts the image to the placeholder default.
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  template {
    service_account = var.api_service_account

    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = 10
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = var.api_image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      env {
        name  = "NODE_ENV"
        value = var.environment == "production" ? "production" : "staging"
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name  = "DB_CONNECTION_NAME"
        value = var.db_connection_name
      }

      env {
        name  = "KMS_KEY_ID"
        value = var.kms_key_id
      }

      dynamic "env" {
        for_each = var.firebase_project_id != "" ? [var.firebase_project_id] : []
        content {
          name  = "FIREBASE_PROJECT_ID"
          value = env.value
        }
      }

      # DATABASE_URL assembled by Terraform, injected at container startup via Secret Manager.
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = var.database_url_secret_name
            version = "latest"
          }
        }
      }

      # RESEND_API_KEY for OTP email delivery
      env {
        name = "RESEND_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.resend_api_key.secret_id
            version = "latest"
          }
        }
      }

      # OTP sender address
      env {
        name  = "OTP_FROM_EMAIL"
        value = var.otp_from_email
      }

      # Vertex AI configuration for AI chat
      dynamic "env" {
        for_each = var.vertex_ai_project != "" ? [var.vertex_ai_project] : []
        content {
          name  = "VERTEX_AI_PROJECT"
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.vertex_ai_project != "" ? [var.vertex_ai_location] : []
        content {
          name  = "VERTEX_AI_LOCATION"
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.vertex_ai_project != "" ? [var.vertex_ai_model] : []
        content {
          name  = "VERTEX_AI_MODEL"
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.vertex_ai_rag_corpus != "" ? [var.vertex_ai_rag_corpus] : []
        content {
          name  = "VERTEX_AI_RAG_CORPUS"
          value = env.value
        }
      }

      # CMS media bucket for signed URL generation
      dynamic "env" {
        for_each = var.cms_media_bucket_name != "" ? [var.cms_media_bucket_name] : []
        content {
          name  = "GCS_CMS_MEDIA_BUCKET"
          value = env.value
        }
      }

      # User media bucket for community image uploads
      dynamic "env" {
        for_each = var.media_bucket_name != "" ? [var.media_bucket_name] : []
        content {
          name  = "GCS_MEDIA_BUCKET"
          value = env.value
        }
      }

      # Shared secret for internal cleanup endpoint (Cloud Scheduler → API)
      env {
        name = "CLEANUP_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.cleanup_secret.secret_id
            version = "latest"
          }
        }
      }

      # Liveness probe — if this fails, Cloud Run restarts the container
      liveness_probe {
        http_get {
          path = "/livez"
        }
        initial_delay_seconds = 10
        period_seconds        = 30
        failure_threshold     = 3
      }

      # Startup probe — must pass before liveness probe starts
      startup_probe {
        http_get {
          path = "/healthz"
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }
    }
  }

  labels = var.labels
}

# Custom domain mapping (v1 API — as of Feb 2026, v2 doesn't support domain mappings)
resource "google_cloud_run_domain_mapping" "api" {
  count    = var.custom_domain != "" ? 1 : 0
  name     = var.custom_domain
  location = var.region
  project  = var.project_id

  metadata {
    namespace = var.project_id
    labels    = var.labels
  }

  spec {
    route_name = google_cloud_run_v2_service.api.name
  }
}

# Public invoker (mobile app calls the API directly)
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Resend API Key (OTP email delivery) ──────────────────────────────────────

resource "google_secret_manager_secret" "resend_api_key" {
  secret_id = "halo-resend-api-key-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_secret_manager_secret_version" "resend_api_key" {
  secret      = google_secret_manager_secret.resend_api_key.id
  secret_data = var.resend_api_key
}

resource "google_secret_manager_secret_iam_member" "api_resend_api_key" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.resend_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.api_service_account}"
}

# ── OTP Cleanup Secret + Cloud Scheduler ─────────────────────────────────────

resource "google_secret_manager_secret" "cleanup_secret" {
  secret_id = "halo-cleanup-secret-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_secret_manager_secret_version" "cleanup_secret" {
  secret      = google_secret_manager_secret.cleanup_secret.id
  secret_data = var.cleanup_secret
}

resource "google_secret_manager_secret_iam_member" "api_cleanup_secret" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.cleanup_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.api_service_account}"
}

# ── Daily Tips Generation (Cloud Run Job + Cloud Scheduler) ─────────────────

resource "google_cloud_run_v2_job" "generate_tips" {
  name                = "halo-api-generate-tips-${var.environment}"
  location            = var.region
  project             = var.project_id
  deletion_protection = false

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }

  template {
    task_count = 1

    template {
      service_account = var.api_service_account
      timeout         = "300s"
      max_retries     = 1

      vpc_access {
        connector = var.vpc_connector_id
        egress    = "ALL_TRAFFIC"
      }

      containers {
        image   = var.api_image
        command = ["node"]
        args    = ["/app/apps/api/dist/jobs/generate-tips-runner.js"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = var.environment == "production" ? "production" : "staging"
        }

        env {
          name  = "GOOGLE_CLOUD_PROJECT"
          value = var.project_id
        }

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = var.database_url_secret_name
              version = "latest"
            }
          }
        }

        dynamic "env" {
          for_each = var.vertex_ai_project != "" ? [var.vertex_ai_project] : []
          content {
            name  = "VERTEX_AI_PROJECT"
            value = env.value
          }
        }

        dynamic "env" {
          for_each = var.vertex_ai_project != "" ? [var.vertex_ai_location] : []
          content {
            name  = "VERTEX_AI_LOCATION"
            value = env.value
          }
        }

        dynamic "env" {
          for_each = var.vertex_ai_project != "" ? [var.vertex_ai_model] : []
          content {
            name  = "VERTEX_AI_MODEL"
            value = env.value
          }
        }
      }
    }
  }

  labels = var.labels
}

resource "google_service_account" "scheduler_tips" {
  account_id   = "halo-sched-tips-${var.environment}"
  display_name = "Halo Tips Scheduler (${var.environment})"
  project      = var.project_id
}

# Deploy SA needs actAs on the scheduler SA to create the Cloud Scheduler job
resource "google_service_account_iam_member" "deploy_acts_as_scheduler_tips" {
  count              = var.deploy_service_account != "" ? 1 : 0
  service_account_id = google_service_account.scheduler_tips.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.deploy_service_account}"
}

resource "google_cloud_run_v2_job_iam_member" "scheduler_tips_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.generate_tips.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_tips.email}"
}

resource "google_cloud_scheduler_job" "generate_tips" {
  name      = "halo-generate-tips-${var.environment}"
  project   = var.project_id
  region    = var.region
  schedule  = "0 0 * * *"
  time_zone = "UTC"

  description = "Daily generation of caregiver tips via Gemini AI"

  http_target {
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.generate_tips.name}:run"
    http_method = "POST"

    oauth_token {
      service_account_email = google_service_account.scheduler_tips.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }

  retry_config {
    retry_count          = 2
    min_backoff_duration = "30s"
    max_backoff_duration = "300s"
  }
}

# Cloud Scheduler job runs daily at 3 AM to purge expired OTP codes
resource "google_cloud_scheduler_job" "otp_cleanup" {
  name      = "halo-otp-cleanup-${var.environment}"
  project   = var.project_id
  region    = var.region
  schedule  = "0 3 * * *"
  time_zone = "UTC"

  description = "Daily cleanup of expired OTP codes (24h retention)"

  # TODO: cleanup_secret appears as plaintext in Terraform state because Cloud Scheduler
  # HTTP targets don't support Secret Manager references for headers. Migrate to OIDC
  # token auth (oidc_token block) to eliminate the shared secret entirely.
  http_target {
    uri         = "${google_cloud_run_v2_service.api.uri}/v1/auth/otp/cleanup"
    http_method = "DELETE"
    headers = {
      "x-cleanup-secret" = var.cleanup_secret
    }
  }

  retry_config {
    retry_count          = 3
    min_backoff_duration = "10s"
    max_backoff_duration = "300s"
  }
}

# ══════════════════════════════════════════════════════════════════════════════
# CMS (Payload CMS — Next.js)
# ══════════════════════════════════════════════════════════════════════════════

# ── Payload Secret (cookie/JWT signing) ──────────────────────────────────────

resource "google_secret_manager_secret" "payload_secret" {
  count     = var.cms_service_account != "" ? 1 : 0
  secret_id = "halo-payload-secret-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_secret_manager_secret_version" "payload_secret" {
  count       = var.cms_service_account != "" ? 1 : 0
  secret      = google_secret_manager_secret.payload_secret[0].id
  secret_data = var.payload_secret
}

resource "google_secret_manager_secret_iam_member" "cms_payload_secret" {
  count     = var.cms_service_account != "" ? 1 : 0
  project   = var.project_id
  secret_id = google_secret_manager_secret.payload_secret[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cms_service_account}"
}

# CMS also needs DATABASE_URL
resource "google_secret_manager_secret_iam_member" "cms_database_url" {
  count     = var.cms_service_account != "" ? 1 : 0
  project   = var.project_id
  secret_id = var.database_url_secret_name
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cms_service_account}"
}

# ── CMS Cloud Run Service ────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "cms" {
  count    = var.cms_service_account != "" ? 1 : 0
  name     = "halo-cms-${var.environment}"
  location = var.region
  project  = var.project_id

  ingress = "INGRESS_TRAFFIC_ALL"

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  template {
    service_account = var.cms_service_account

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = var.cms_image

      ports {
        container_port = 3001
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
        cpu_idle = true
      }

      # CMS always uses NODE_ENV=production so Payload runs prodMigrations on startup.
      # The staging/production distinction comes from which DATABASE_URL is injected.
      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name  = "GCS_BUCKET"
        value = var.cms_media_bucket_name
      }

      env {
        name  = "PAYLOAD_PUBLIC_SERVER_URL"
        value = var.cms_server_url
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = var.database_url_secret_name
            version = "latest"
          }
        }
      }

      env {
        name  = "DB_SERVER_CA_CERT"
        value = var.db_server_ca_cert
      }

      env {
        name = "PAYLOAD_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.payload_secret[0].secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        tcp_socket {
          port = 3001
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }
    }
  }

  labels = var.labels
}

# Public invoker — CMS admin panel accessed via browser
resource "google_cloud_run_v2_service_iam_member" "cms_public_invoker" {
  count    = var.cms_service_account != "" ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.cms[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
