variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "environment" {
  description = "Deployment environment (staging, production)"
  type        = string
}

variable "vpc_network_id" {
  description = "VPC network ID (projects/{project}/global/networks/{name})"
  type        = string
}

variable "deploy_service_account" {
  description = "Deploy service account email (needs workerPoolUser)"
  type        = string
}

variable "github_connection_name" {
  description = "Cloud Build GitHub connection name (created via Console)"
  type        = string
}

variable "github_repo_name" {
  description = "Repository name as linked in the Cloud Build connection (e.g. haloteam-halo-v1)"
  type        = string
}

variable "build_triggers_enabled" {
  description = "Whether to provision the Cloud Build triggers. Set false during the EU migration until the regional GitHub connection is manually created via Console."
  type        = bool
  default     = true
}
