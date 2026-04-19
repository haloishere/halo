output "worker_pool_id" {
  description = "Full resource name of the Cloud Build worker pool"
  value       = google_cloudbuild_worker_pool.pool.id
}

output "trigger_id" {
  description = "Cloud Build trigger ID (null while triggers are gated off for migration)"
  value       = var.build_triggers_enabled ? google_cloudbuild_trigger.api_deploy[0].trigger_id : null
}
