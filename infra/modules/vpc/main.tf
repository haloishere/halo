resource "google_compute_network" "halo" {
  name                    = "halo-vpc-${var.environment}"
  auto_create_subnetworks = false
  project                 = var.project_id
}

resource "google_compute_subnetwork" "halo" {
  name                     = "halo-subnet-${var.environment}"
  ip_cidr_range            = "10.0.0.0/24"
  region                   = var.region
  network                  = google_compute_network.halo.self_link
  project                  = var.project_id
  private_ip_google_access = true
}

resource "google_compute_router" "halo" {
  name    = "halo-router-${var.environment}"
  region  = var.region
  network = google_compute_network.halo.self_link
  project = var.project_id
}

resource "google_compute_router_nat" "halo" {
  name                               = "halo-nat-${var.environment}"
  router                             = google_compute_router.halo.name
  region                             = var.region
  project                            = var.project_id
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  enable_endpoint_independent_mapping = true
  min_ports_per_vm                    = 128
}

# ── Private Services Connection (required for Cloud SQL private IP) ───────────
# Allocates an internal IP range and peers it with Google's service producer VPC.
# Cloud SQL uses this peering to assign a private IP on the VPC.

resource "google_compute_global_address" "private_ip_range" {
  name          = "halo-private-ip-range-${var.environment}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.halo.id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_service" {
  network                 = google_compute_network.halo.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# ── Serverless VPC Access Connector (Holda pattern) ──────────────────────────
# All Cloud Run workloads attach to this connector for egress. Matches
# Holda's proven config 1:1 — see /holda/infra/modules/vpc/main.tf:16-24.
# We moved to europe-west1 because us-central1 + halo-493622 consistently
# hit GCP "internal error" on connector creation (3 failures in a row;
# same config went READY first try in europe-west1).

resource "google_project_service" "vpcaccess" {
  project            = var.project_id
  service            = "vpcaccess.googleapis.com"
  disable_on_destroy = false
}

resource "google_vpc_access_connector" "halo" {
  name           = "halo-connector-${var.environment}"
  region         = var.region
  project        = var.project_id
  network        = google_compute_network.halo.name
  ip_cidr_range  = "10.8.0.0/28"
  min_throughput = 200
  max_throughput = 1000

  depends_on = [google_project_service.vpcaccess]
}
