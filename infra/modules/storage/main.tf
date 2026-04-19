resource "random_id" "suffix" {
  byte_length = 4
}

# ── Audit Logs Bucket (created first — others log to it) ─────────────────────

resource "google_storage_bucket" "audit_logs" {
  name          = "halo-audit-logs-${var.environment}-${random_id.suffix.hex}"
  location      = var.region
  project       = var.project_id
  storage_class = "STANDARD"

  # Temporary for the us-central1 → europe-west1 migration. Revert to
  # default (false) in Phase D once staging has meaningful audit content.
  force_destroy = true

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  retention_policy {
    retention_period = 31536000 # 365 days
  }

  # CMEK: audit logs are HIPAA-adjacent — protect under the same project KMS key as media/state
  encryption {
    default_kms_key_name = var.kms_key_id
  }

  labels = var.labels
}

# ── Terraform State Bucket ────────────────────────────────────────────────────

resource "google_storage_bucket" "tf_state" {
  name          = "halo-tf-state-${var.environment}-${random_id.suffix.hex}"
  location      = var.region
  project       = var.project_id
  storage_class = "STANDARD"

  force_destroy = true # migration flip — see note on audit_logs

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  encryption {
    default_kms_key_name = var.kms_key_id
  }

  # Access logging for state bucket audit trail
  logging {
    log_bucket = google_storage_bucket.audit_logs.name
  }

  labels = var.labels
}

# ── Media Bucket (user uploads) ───────────────────────────────────────────────

resource "google_storage_bucket" "media" {
  name          = "halo-media-${var.environment}-${random_id.suffix.hex}"
  location      = var.region
  project       = var.project_id
  storage_class = "STANDARD"

  force_destroy = true # migration flip — see note on audit_logs

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  encryption {
    default_kms_key_name = var.kms_key_id
  }

  lifecycle_rule {
    condition {
      age = 365 # Delete media after 1 year
    }
    action {
      type = "Delete"
    }
  }

  labels = var.labels
}

# ── CMS Media Bucket (article images — no lifecycle delete) ──────────────────

resource "google_storage_bucket" "cms_media" {
  name          = "halo-cms-media-${var.environment}-${random_id.suffix.hex}"
  location      = var.region
  project       = var.project_id
  storage_class = "STANDARD"

  force_destroy = true # migration flip — see note on audit_logs

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  encryption {
    default_kms_key_name = var.kms_key_id
  }

  # No lifecycle delete — article images are permanent content assets

  labels = var.labels
}
