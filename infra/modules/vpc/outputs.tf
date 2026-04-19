output "network_self_link" {
  value = google_compute_network.halo.self_link
}
output "network_id" {
  description = "VPC network ID (projects/{project}/global/networks/{name})"
  value       = google_compute_network.halo.id
}
output "subnet_self_link" {
  value = google_compute_subnetwork.halo.self_link
}
output "network_name" {
  value = google_compute_network.halo.name
}
output "subnet_name" {
  value = google_compute_subnetwork.halo.name
}

output "private_service_connection_id" {
  description = "Service networking connection — Cloud SQL module must depend on this before creation"
  value       = google_service_networking_connection.private_service.id
}

output "connector_id" {
  description = "Serverless VPC Access connector ID — Cloud Run services attach to this"
  value       = google_vpc_access_connector.halo.id
}
