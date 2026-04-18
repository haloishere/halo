# Copy to terraform.tfvars (git-ignored) and fill in real values.
# NEVER commit terraform.tfvars — it may contain sensitive configuration.

project_id          = "your-gcp-project-id"
region              = "us-central1"
environment         = "development" # development | staging | production
github_org          = "haloishere"
github_repo         = "halo"
db_instance_tier    = "db-f1-micro"           # db-g1-small for staging, db-custom-2-7680 for prod
api_image           = "gcr.io/cloudrun/hello" # replaced by cloudbuild.yaml on first deploy
api_custom_domain   = ""                      # e.g. "api-staging.haloapp.tech" (requires verified domain)
firebase_project_id = ""                      # e.g. "halo-xxxxx" (when Firebase is in a separate GCP project)
