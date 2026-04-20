locals {
  instance_name = var.instance_suffix != "" ? "halo-db-${var.environment}-${var.instance_suffix}" : "halo-db-${var.environment}"
}

resource "google_sql_database_instance" "halo" {
  name             = local.instance_name
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  # CMEK encryption
  encryption_key_name = var.kms_key_id

  deletion_protection = true

  settings {
    tier              = var.instance_tier
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"

    database_flags {
      name  = "cloudsql.enable_pgaudit"
      value = "on"
    }
    database_flags {
      name  = "max_connections"
      value = "100"
    }

    ip_configuration {
      ipv4_enabled    = false # No public IP — private VPC only
      private_network = var.vpc_self_link
      ssl_mode        = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled    = true
      start_time = "03:00"
      location   = "us" # Geo-redundant backups

      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }

      transaction_log_retention_days = 7
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 256 # minimum valid (256-4500); safe with parameterized queries (Drizzle ORM)
      record_application_tags = true
      record_client_address   = false # Privacy: no client IPs in logs
    }

    user_labels = var.labels
  }
}

resource "google_sql_database" "halo" {
  name     = "halo"
  instance = google_sql_database_instance.halo.name
  project  = var.project_id
}

# App DB user — password stored in Secret Manager (see iam module)
resource "google_sql_user" "app" {
  name     = "halo_app"
  instance = google_sql_database_instance.halo.name
  project  = var.project_id
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "halo-db-app-password-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = merge(var.labels, {
    # Terraform cannot automate Secret Manager rotation; label documents status only
    # TODO: wire rotation via google_secret_manager_secret.rotation_policy when supported
    "rotation-status" = "manual-only"
  })
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = google_sql_user.app.password
}

# Grant API SA access to the DB password secret
resource "google_secret_manager_secret_iam_member" "api_db_password" {
  secret_id = google_secret_manager_secret.db_password.secret_id
  project   = var.project_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.api_service_account}"
}

# ── DATABASE_URL ─────────────────────────────────────────────────────────────
# Terraform assembles the full connection URL from auto-generated password + private IP.
# Cloud Run reads it via secret_key_ref. Avoids any manual post-apply composition.

locals {
  db_private_ip = tostring(one([
    for addr in google_sql_database_instance.halo.ip_address : addr.ip_address
    if addr.type == "PRIVATE"
  ]))
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "halo-api-database-url-${var.environment}"
  project   = var.project_id
  replication {
    auto {}
  }
  labels = merge(var.labels, { rotation-status = "manual-only" })
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.database_url.id
  secret_data = join("", [
    "postgresql://halo_app:",
    urlencode(random_password.db_password.result),
    "@",
    local.db_private_ip,
    "/halo?sslmode=require"
  ])
}

# API runtime SA reads DATABASE_URL at startup (Cloud Run secret_key_ref)
resource "google_secret_manager_secret_iam_member" "api_database_url" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.api_service_account}"
}
