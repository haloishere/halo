output "cloud_run_url" {
  description = "URL of the deployed Cloud Run API service"
  value       = module.cloud_run.service_url
}

output "cloud_run_service_name" {
  description = "Cloud Run service name"
  value       = module.cloud_run.service_name
}

output "db_connection_name" {
  description = "Cloud SQL connection name (project:region:instance)"
  value       = module.cloud_sql.connection_name
}

output "kms_key_id" {
  description = "Resource ID of the envelope encryption KMS key"
  value       = module.kms.key_id
}

output "kms_keyring_id" {
  description = "Resource ID of the KMS key ring"
  value       = module.kms.keyring_id
}

output "api_service_account_email" {
  description = "Email of the Cloud Run runtime service account"
  value       = module.iam.api_service_account_email
}

output "deploy_service_account_email" {
  description = "Email of the CI/CD deploy service account"
  value       = module.iam.deploy_service_account_email
}

output "workload_identity_provider" {
  description = "Workload Identity Provider resource name for GitHub Actions"
  value       = module.iam.workload_identity_provider
}

output "artifact_registry_url" {
  description = "Artifact Registry Docker repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/halo"
}

output "cloud_build_worker_pool_id" {
  description = "Cloud Build private worker pool resource name"
  value       = module.cloud_build.worker_pool_id
}

output "cms_service_url" {
  description = "URL of the deployed Cloud Run CMS service"
  value       = module.cloud_run.cms_service_url
}

output "cms_service_account_email" {
  description = "Email of the CMS Cloud Run runtime service account"
  value       = module.iam.cms_service_account_email
}

output "api_domain_dns_records" {
  description = "DNS records to add in Cloudflare for the API custom domain"
  value       = module.cloud_run.domain_mapping_dns_records
}
