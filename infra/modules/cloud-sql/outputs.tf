output "connection_name" {
  description = "Cloud SQL connection name (project:region:instance)"
  value       = google_sql_database_instance.halo.connection_name
}
output "instance_name" {
  value = google_sql_database_instance.halo.name
}
output "db_password_secret_id" {
  value = google_secret_manager_secret.db_password.secret_id
}

output "server_ca_cert" {
  description = "Cloud SQL server CA certificate for TLS verification"
  value       = google_sql_database_instance.halo.server_ca_cert[0].cert
  sensitive   = true
}

output "database_url_secret_name" {
  description = "Secret Manager secret name for the full DATABASE_URL connection string"
  value       = google_secret_manager_secret.database_url.secret_id
}
