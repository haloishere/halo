variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment (development, staging, production)"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be one of: development, staging, production"
  }
}

variable "api_image" {
  description = "Full container image URL for the API service"
  type        = string
  default     = "gcr.io/cloudrun/hello" # placeholder until first real build
}

variable "github_org" {
  description = "GitHub organization name for Workload Identity Federation"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (without org prefix) for WIF repo-level scope"
  type        = string
  default     = "halo"
}

variable "db_instance_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro"
}

variable "notification_channels" {
  description = "List of GCP notification channel IDs for alert policies (e.g. projects/PROJECT/notificationChannels/ID)"
  type        = list(string)
  default     = []
}

variable "min_instance_count" {
  description = "Minimum Cloud Run instances (0 for staging, 1 for production)"
  type        = number
  default     = 0
}

variable "db_instance_suffix" {
  description = "Suffix for Cloud SQL instance name (use to bypass name reservation after deletion)"
  type        = string
  default     = ""
}

variable "api_custom_domain" {
  description = "Custom domain for the API (e.g. api-staging.haloapp.tech). Empty string disables mapping."
  type        = string
  default     = ""
  validation {
    condition     = var.api_custom_domain == "" || can(regex("^[a-z0-9][a-z0-9.-]+[a-z0-9]$", var.api_custom_domain))
    error_message = "api_custom_domain must be a valid domain name (lowercase, digits, dots, hyphens)."
  }
}

variable "resend_api_key" {
  description = "Resend API key for OTP email delivery"
  type        = string
  sensitive   = true
}

variable "otp_from_email" {
  description = "Sender address for OTP verification emails"
  type        = string
  default     = "Halo <noreply@haloapp.tech>"
}

variable "cleanup_secret" {
  description = "Shared secret for the internal OTP cleanup endpoint (Cloud Scheduler)"
  type        = string
  sensitive   = true
}

variable "firebase_project_id" {
  description = "Firebase project ID for cross-project auth (e.g. halo-xxxxx). Empty disables the binding."
  type        = string
  default     = ""
  validation {
    condition     = var.firebase_project_id == "" || can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.firebase_project_id))
    error_message = "firebase_project_id must be a valid GCP project ID (6-30 chars, lowercase, digits, hyphens)."
  }
}

variable "vertex_ai_project" {
  description = "GCP project ID for Vertex AI. Empty string disables AI client initialization."
  type        = string
  default     = ""
}

variable "vertex_ai_location" {
  description = "GCP region for Vertex AI endpoint."
  type        = string
  default     = "europe-west1"
}

variable "vertex_ai_model" {
  description = "Vertex AI model ID for AI chat. Set via VERTEX_AI_MODEL GitHub Actions variable."
  type        = string
}

variable "vertex_ai_rag_corpus" {
  description = "Vertex AI RAG corpus resource name for grounding AI responses. Set via VERTEX_AI_RAG_CORPUS GitHub Actions variable."
  type        = string
  default     = ""
}

variable "cms_image" {
  description = "Full container image URL for the CMS service"
  type        = string
  default     = "gcr.io/cloudrun/hello" # placeholder until first real build
}

variable "cms_server_url" {
  description = "Public URL for the CMS Cloud Run service. Used by Payload for CSRF and absolute URLs."
  type        = string
  default     = ""
}

variable "payload_secret" {
  description = "Payload CMS secret for cookie/JWT signing"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_connection_name" {
  description = "Cloud Build GitHub connection name (created via Console)"
  type        = string
  default     = "halo-build"
}

variable "github_repo_name" {
  description = "Repository name as linked in Cloud Build connection"
  type        = string
  default     = "haloishere-halo"
}
