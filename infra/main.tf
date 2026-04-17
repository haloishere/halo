locals {
  common_labels = {
    app         = "halo"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ── Required APIs ────────────────────────────────────────────────────────────
resource "google_project_service" "cloud_scheduler" {
  project            = var.project_id
  service            = "cloudscheduler.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "identity_toolkit" {
  project            = var.project_id
  service            = "identitytoolkit.googleapis.com"
  disable_on_destroy = false
}

module "kms" {
  source      = "./modules/kms"
  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  labels      = local.common_labels
}

module "storage" {
  source      = "./modules/storage"
  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  kms_key_id  = module.kms.key_id
  labels      = local.common_labels
}

module "vpc" {
  source      = "./modules/vpc"
  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  labels      = local.common_labels
}

module "iam" {
  source                   = "./modules/iam"
  project_id               = var.project_id
  region                   = var.region
  environment              = var.environment
  kms_key_id               = module.kms.key_id
  media_bucket_name        = module.storage.media_bucket_name
  cms_media_bucket_name    = module.storage.cms_media_bucket_name
  github_org               = var.github_org
  github_repo              = var.github_repo
  database_url_secret_name = module.cloud_sql.database_url_secret_name
  firebase_project_id      = var.firebase_project_id
  labels                   = local.common_labels
}

module "cloud_sql" {
  source                        = "./modules/cloud-sql"
  project_id                    = var.project_id
  region                        = var.region
  environment                   = var.environment
  instance_tier                 = var.db_instance_tier
  vpc_self_link                 = module.vpc.network_self_link
  kms_key_id                    = module.kms.key_id
  api_service_account           = module.iam.api_service_account_email
  private_service_connection_id = module.vpc.private_service_connection_id
  instance_suffix               = var.db_instance_suffix
  labels                        = local.common_labels

  depends_on = [module.vpc]
}

module "cloud_build" {
  source                 = "./modules/cloud-build"
  project_id             = var.project_id
  region                 = var.region
  environment            = var.environment
  vpc_network_id         = module.vpc.network_id
  deploy_service_account = module.iam.deploy_service_account_email
  github_connection_name = var.github_connection_name
  github_repo_name       = var.github_repo_name
}

module "cloud_run" {
  source                   = "./modules/cloud-run"
  project_id               = var.project_id
  region                   = var.region
  environment              = var.environment
  api_image                = var.api_image
  vpc_connector_id         = module.vpc.connector_id
  db_connection_name       = module.cloud_sql.connection_name
  kms_key_id               = module.kms.key_id
  api_service_account      = module.iam.api_service_account_email
  security_policy_id       = module.cloud_armor.security_policy_id
  database_url_secret_name = module.cloud_sql.database_url_secret_name
  min_instance_count       = var.min_instance_count
  custom_domain            = var.api_custom_domain
  firebase_project_id      = var.firebase_project_id
  resend_api_key           = var.resend_api_key
  otp_from_email           = var.otp_from_email
  cleanup_secret           = var.cleanup_secret
  vertex_ai_project        = var.vertex_ai_project
  vertex_ai_location       = var.vertex_ai_location
  vertex_ai_model          = var.vertex_ai_model
  vertex_ai_rag_corpus     = var.vertex_ai_rag_corpus
  media_bucket_name        = module.storage.media_bucket_name
  deploy_service_account   = module.iam.deploy_service_account_email
  cms_image                = var.cms_image
  cms_service_account      = module.iam.cms_service_account_email
  cms_media_bucket_name    = module.storage.cms_media_bucket_name
  payload_secret           = var.payload_secret
  cms_server_url           = var.cms_server_url
  db_server_ca_cert        = module.cloud_sql.server_ca_cert
  labels                   = local.common_labels

  depends_on = [google_project_service.cloud_scheduler]
}

module "monitoring" {
  source                = "./modules/monitoring"
  project_id            = var.project_id
  region                = var.region
  environment           = var.environment
  cloud_run_url         = module.cloud_run.service_url
  audit_bucket          = module.storage.audit_bucket_name
  notification_channels = var.notification_channels
  labels                = local.common_labels
}

module "cloud_armor" {
  source      = "./modules/cloud-armor"
  project_id  = var.project_id
  environment = var.environment
  labels      = local.common_labels
}
