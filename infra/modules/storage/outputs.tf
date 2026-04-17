output "media_bucket_name" { value = google_storage_bucket.media.name }
output "tf_state_bucket_name" { value = google_storage_bucket.tf_state.name }
output "audit_bucket_name" { value = google_storage_bucket.audit_logs.name }
output "cms_media_bucket_name" { value = google_storage_bucket.cms_media.name }
