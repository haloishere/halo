variables {
  project_id  = "halo-test"
  region      = "us-central1"
  environment = "development"
  labels      = { app = "halo", environment = "development", managed_by = "terraform" }
}

run "vpc_cidr_and_private_access" {
  command = plan

  module {
    source = "./modules/vpc"
  }

  assert {
    condition     = google_compute_subnetwork.halo.ip_cidr_range == "10.0.0.0/24"
    error_message = "Subnet CIDR must be 10.0.0.0/24"
  }

  assert {
    condition     = google_compute_subnetwork.halo.private_ip_google_access == true
    error_message = "Private Google Access must be enabled on the subnet"
  }
}

run "vpc_connector_exists" {
  command = plan

  module {
    source = "./modules/vpc"
  }

  assert {
    condition     = google_vpc_access_connector.halo.ip_cidr_range == "10.8.0.0/28"
    error_message = "VPC connector must use 10.8.0.0/28 CIDR"
  }

  assert {
    condition     = google_vpc_access_connector.halo.min_throughput == 200
    error_message = "Connector min throughput must be 200 Mbps"
  }
}
