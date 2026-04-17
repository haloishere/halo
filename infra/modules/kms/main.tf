resource "google_kms_key_ring" "halo" {
  name     = "halo-keyring-${var.environment}"
  location = var.region
  project  = var.project_id
}

resource "google_kms_crypto_key" "dek_kek" {
  name            = "halo-dek-kek"
  key_ring        = google_kms_key_ring.halo.id
  rotation_period = "7776000s" # 90 days

  lifecycle {
    prevent_destroy = true
  }

  labels = var.labels
}

# GCS service agent needs cryptoKeyEncrypterDecrypter to use CMEK on buckets.
# This is a Google-managed per-project service account, distinct from user SAs.
data "google_storage_project_service_account" "gcs" {
  project = var.project_id
}

resource "google_kms_crypto_key_iam_member" "gcs_kms" {
  crypto_key_id = google_kms_crypto_key.dek_kek.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${data.google_storage_project_service_account.gcs.email_address}"
}

# Cloud SQL service agent needs cryptoKeyEncrypterDecrypter for CMEK-encrypted instances.
resource "google_project_service_identity" "sqladmin" {
  provider = google-beta
  project  = var.project_id
  service  = "sqladmin.googleapis.com"
}

resource "google_kms_crypto_key_iam_member" "cloudsql_kms" {
  crypto_key_id = google_kms_crypto_key.dek_kek.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_project_service_identity.sqladmin.email}"
}
