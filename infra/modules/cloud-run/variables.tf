variable "project_id" {
  type = string
}
variable "region" {
  type = string
}
variable "environment" {
  type = string
}
variable "api_image" {
  type = string
}
variable "vpc_connector_id" {
  type = string
}
variable "db_connection_name" {
  type = string
}
variable "kms_key_id" {
  type = string
}
variable "api_service_account" {
  type = string
}
variable "security_policy_id" {
  type    = string
  default = ""
  # NOTE: Cloud Armor policies require a Cloud Load Balancer (HTTPS LB with serverless NEG).
  # This variable is declared for future LB integration but is not yet wired to Cloud Run.
  # TODO: Wire to google_compute_backend_service.security_policy when LB module is added.
}
variable "labels" {
  type    = map(string)
  default = {}
}

variable "custom_domain" {
  type        = string
  default     = ""
  description = "Custom domain to map to the Cloud Run service (e.g. api-staging.halo.life). Empty string disables mapping."
}

variable "firebase_project_id" {
  type        = string
  default     = ""
  description = "Firebase project ID for token verification (when Firebase is in a separate GCP project)."
}

variable "database_url_secret_name" {
  type        = string
  description = "Secret Manager secret name containing the full DATABASE_URL"
}

variable "min_instance_count" {
  type        = number
  default     = 0
  description = "Min Cloud Run instances. 0 = cost-optimal for staging. 1 = no cold start for production."
}

variable "resend_api_key" {
  type        = string
  sensitive   = true
  description = "Resend API key for OTP email delivery. Stored in Secret Manager."
}

variable "otp_from_email" {
  type        = string
  default     = "Halo <noreply@halo.life>"
  description = "Sender address for OTP verification emails."
}

variable "cleanup_secret" {
  type        = string
  sensitive   = true
  description = "Shared secret for the internal OTP cleanup endpoint. Used by Cloud Scheduler."
}

variable "vertex_ai_project" {
  type        = string
  default     = ""
  description = "GCP project ID for Vertex AI. Empty string disables AI client initialization."
}

variable "vertex_ai_location" {
  type        = string
  default     = "us-central1"
  description = "GCP region for Vertex AI endpoint."
}

variable "vertex_ai_model" {
  type        = string
  description = "Vertex AI model ID for AI chat. Set via VERTEX_AI_MODEL GitHub Actions variable."
}

variable "vertex_ai_rag_corpus" {
  type        = string
  default     = ""
  description = "Vertex AI RAG corpus resource name for grounding. Set via VERTEX_AI_RAG_CORPUS GitHub Actions variable."
}

variable "media_bucket_name" {
  type        = string
  default     = ""
  description = "GCS bucket name for user media uploads (community post images)."
}

variable "deploy_service_account" {
  type        = string
  default     = ""
  description = "Deploy SA email — needs actAs on scheduler SAs created in this module."
}

variable "cms_image" {
  type        = string
  default     = "gcr.io/cloudrun/hello"
  description = "Full container image URL for the CMS service"
}

variable "cms_service_account" {
  type        = string
  default     = ""
  description = "CMS Cloud Run runtime service account email"
}

variable "cms_media_bucket_name" {
  type        = string
  default     = ""
  description = "GCS bucket name for CMS media uploads"
}

variable "db_server_ca_cert" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Cloud SQL server CA certificate for TLS verification by the CMS pg driver."
}

variable "cms_server_url" {
  type        = string
  default     = ""
  description = "Public URL for the CMS Cloud Run service (e.g. https://halo-cms-staging-xxx.run.app). Used by Payload for CSRF and absolute URLs."
}

variable "payload_secret" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Payload CMS secret for cookie/JWT signing. Stored in Secret Manager."
}
