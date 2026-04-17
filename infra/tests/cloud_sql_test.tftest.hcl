variables {
  project_id          = "halo-test"
  region              = "us-central1"
  environment         = "development"
  vpc_self_link       = "projects/halo-test/global/networks/halo-vpc-development"
  kms_key_id          = "projects/halo-test/locations/us-central1/keyRings/halo-keyring/cryptoKeys/halo-dek-kek"
  api_service_account = "halo-api@halo-test.iam.gserviceaccount.com"
  labels              = { app = "halo", environment = "development", managed_by = "terraform" }
}

run "no_public_ip" {
  command = plan

  module {
    source = "./modules/cloud-sql"
  }

  assert {
    condition     = google_sql_database_instance.halo.settings[0].ip_configuration[0].ipv4_enabled == false
    error_message = "Cloud SQL must NOT have a public IP"
  }
}

run "ssl_required" {
  command = plan

  module {
    source = "./modules/cloud-sql"
  }

  assert {
    condition     = google_sql_database_instance.halo.settings[0].ip_configuration[0].ssl_mode == "ENCRYPTED_ONLY"
    error_message = "Cloud SQL must enforce SSL (ssl_mode = ENCRYPTED_ONLY)"
  }
}

run "backup_retention_30_days" {
  command = plan

  module {
    source = "./modules/cloud-sql"
  }

  assert {
    condition     = google_sql_database_instance.halo.settings[0].backup_configuration[0].enabled == true
    error_message = "Backups must be enabled"
  }

  assert {
    condition     = google_sql_database_instance.halo.settings[0].backup_configuration[0].backup_retention_settings[0].retained_backups == 30
    error_message = "Must retain at least 30 backups"
  }
}

run "deletion_protection_enabled" {
  command = plan

  module {
    source = "./modules/cloud-sql"
  }

  assert {
    condition     = google_sql_database_instance.halo.deletion_protection == true
    error_message = "Deletion protection must be enabled on Cloud SQL"
  }
}
