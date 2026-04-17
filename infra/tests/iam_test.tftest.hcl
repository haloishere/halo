variables {
  project_id        = "halo-test"
  region            = "us-central1"
  environment       = "development"
  kms_key_id        = "projects/halo-test/locations/us-central1/keyRings/halo-keyring/cryptoKeys/halo-dek-kek"
  media_bucket_name = "halo-media-development-abc123"
  github_org        = "halo-life"
  labels            = { app = "halo", environment = "development", managed_by = "terraform" }
}

run "separate_service_accounts" {
  command = plan

  module {
    source = "./modules/iam"
  }

  assert {
    condition     = google_service_account.api.account_id != google_service_account.deploy.account_id
    error_message = "API and deploy service accounts must be different"
  }
}

run "no_admin_roles_on_api_sa" {
  command = plan

  module {
    source = "./modules/iam"
  }

  assert {
    condition     = google_project_iam_member.api_cloudsql.role != "roles/owner" && google_project_iam_member.api_cloudsql.role != "roles/editor"
    error_message = "API SA must not have owner or editor role"
  }
}

run "wif_repo_restriction" {
  command = plan

  module {
    source = "./modules/iam"
  }

  assert {
    # Verify repo-level restriction (assertion.repository == 'org/repo'), not org-level.
    # Org-level (repository_owner) would allow any repo in the org to authenticate.
    condition     = can(regex("assertion\\.repository\\s*==", google_iam_workload_identity_pool_provider.github.attribute_condition))
    error_message = "WIF provider must restrict by specific repository identity (assertion.repository), not org-level (repository_owner)"
  }
}

run "media_operator_no_delete" {
  command = plan

  module {
    source = "./modules/iam"
  }

  assert {
    condition     = !contains(google_project_iam_custom_role.media_operator.permissions, "storage.objects.delete")
    error_message = "Media operator custom role must NOT include storage.objects.delete"
  }
}
