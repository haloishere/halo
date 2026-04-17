variables {
  project_id  = "halo-test"
  region      = "us-central1"
  environment = "development"
  kms_key_id  = "projects/halo-test/locations/us-central1/keyRings/halo/cryptoKeys/halo-dek-kek"
  labels      = { app = "halo", environment = "development", managed_by = "terraform" }
}

run "audit_bucket_public_access_prevented" {
  command = plan

  module {
    source = "./modules/storage"
  }

  assert {
    condition     = google_storage_bucket.audit_logs.public_access_prevention == "enforced"
    error_message = "Audit logs bucket must have public access prevention enforced"
  }
}

run "audit_bucket_retention_365_days" {
  command = plan

  module {
    source = "./modules/storage"
  }

  assert {
    condition     = google_storage_bucket.audit_logs.retention_policy[0].retention_period == 31536000
    error_message = "Audit logs bucket must retain data for 365 days (31536000 seconds)"
  }
}

run "audit_bucket_uniform_access" {
  command = plan

  module {
    source = "./modules/storage"
  }

  assert {
    condition     = google_storage_bucket.audit_logs.uniform_bucket_level_access == true
    error_message = "Audit logs bucket must use uniform bucket-level access"
  }
}

run "media_bucket_kms_encrypted" {
  command = plan

  module {
    source = "./modules/storage"
  }

  assert {
    condition     = google_storage_bucket.media.encryption[0].default_kms_key_name == var.kms_key_id
    error_message = "Media bucket must be encrypted with the project KMS key"
  }
}

run "media_bucket_public_access_prevented" {
  command = plan

  module {
    source = "./modules/storage"
  }

  assert {
    condition     = google_storage_bucket.media.public_access_prevention == "enforced"
    error_message = "Media bucket must have public access prevention enforced"
  }
}

run "tf_state_versioning_enabled" {
  command = plan

  module {
    source = "./modules/storage"
  }

  assert {
    condition     = google_storage_bucket.tf_state.versioning[0].enabled == true
    error_message = "Terraform state bucket must have versioning enabled"
  }
}

run "audit_bucket_kms_encrypted" {
  command = plan

  module {
    source = "./modules/storage"
  }

  assert {
    condition     = google_storage_bucket.audit_logs.encryption[0].default_kms_key_name == var.kms_key_id
    error_message = "Audit logs bucket must be encrypted with the project KMS key (HIPAA-adjacent data)"
  }
}
