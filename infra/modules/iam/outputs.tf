output "api_service_account_email" {
  value = google_service_account.api.email
}
output "cms_service_account_email" {
  value = google_service_account.cms.email
}
output "deploy_service_account_email" {
  value = google_service_account.deploy.email
}
output "workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}
output "workload_identity_pool_id" {
  value = google_iam_workload_identity_pool.github.workload_identity_pool_id
}
