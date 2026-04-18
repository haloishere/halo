output "service_url" {
  value = google_cloud_run_v2_service.api.uri
}
output "service_name" {
  value = google_cloud_run_v2_service.api.name
}
output "artifact_registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/halo"
}

output "cms_service_url" {
  value = var.cms_service_account != "" ? google_cloud_run_v2_service.cms[0].uri : ""
}

output "domain_mapping_dns_records" {
  description = "DNS records to configure for the custom domain"
  value       = try(google_cloud_run_domain_mapping.api[0].status[0].resource_records, [])
}
