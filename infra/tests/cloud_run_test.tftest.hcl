variables {
  project_id          = "halo-test"
  region              = "us-central1"
  environment         = "development"
  api_image           = "gcr.io/cloudrun/hello"
  vpc_connector_id    = "projects/halo-test/locations/us-central1/connectors/halo-connector-development"
  db_connection_name  = "halo-test:us-central1:halo-db-development"
  kms_key_id          = "projects/halo-test/locations/us-central1/keyRings/halo-keyring/cryptoKeys/halo-dek-kek"
  api_service_account = "halo-api@halo-test.iam.gserviceaccount.com"
  labels              = { app = "halo", environment = "development", managed_by = "terraform" }
}

run "vpc_egress_all_traffic" {
  command = plan

  module {
    source = "./modules/cloud-run"
  }

  assert {
    condition     = google_cloud_run_v2_service.api.template[0].vpc_access[0].egress == "ALL_TRAFFIC"
    error_message = "Cloud Run must route ALL_TRAFFIC through VPC connector"
  }
}

run "health_probes_configured" {
  command = plan

  module {
    source = "./modules/cloud-run"
  }

  assert {
    condition     = google_cloud_run_v2_service.api.template[0].containers[0].liveness_probe[0].http_get[0].path == "/livez"
    error_message = "Liveness probe must check /livez"
  }

  assert {
    condition     = google_cloud_run_v2_service.api.template[0].containers[0].startup_probe[0].http_get[0].path == "/healthz"
    error_message = "Startup probe must check /healthz"
  }
}

run "env_vars_present" {
  command = plan

  module {
    source = "./modules/cloud-run"
  }

  assert {
    condition     = length([for e in google_cloud_run_v2_service.api.template[0].containers[0].env : e if e.name == "GOOGLE_CLOUD_PROJECT"]) > 0
    error_message = "GOOGLE_CLOUD_PROJECT env var must be set"
  }

  assert {
    condition     = length([for e in google_cloud_run_v2_service.api.template[0].containers[0].env : e if e.name == "DB_CONNECTION_NAME"]) > 0
    error_message = "DB_CONNECTION_NAME env var must be set"
  }
}
