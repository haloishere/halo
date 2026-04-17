variables {
  project_id  = "halo-test"
  region      = "us-central1"
  environment = "development"
  labels      = { app = "halo", environment = "development", managed_by = "terraform" }
}

run "key_rotation_set" {
  command = plan

  module {
    source = "./modules/kms"
  }

  assert {
    condition     = google_kms_crypto_key.dek_kek.rotation_period == "7776000s"
    error_message = "KMS key must have 90-day rotation period (7776000s)"
  }
}

run "kms_key_name_correct" {
  command = plan

  module {
    source = "./modules/kms"
  }

  assert {
    condition     = google_kms_crypto_key.dek_kek.name == "halo-dek-kek"
    error_message = "KMS key must be named halo-dek-kek"
  }
}

run "keyring_in_correct_region" {
  command = plan

  module {
    source = "./modules/kms"
  }

  assert {
    condition     = google_kms_key_ring.halo.location == "us-central1"
    error_message = "KMS key ring must be in us-central1"
  }
}

run "key_prevent_destroy_enabled" {
  command = plan

  module {
    source = "./modules/kms"
  }

  assert {
    condition     = google_kms_crypto_key.dek_kek.lifecycle[0].prevent_destroy == true
    error_message = "KMS encryption key must have prevent_destroy = true — deleting it would permanently destroy access to all encrypted patient data"
  }
}
