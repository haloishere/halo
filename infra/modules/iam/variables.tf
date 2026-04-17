variable "project_id" {
  type = string
}
variable "region" {
  type = string
}
variable "environment" {
  type = string
}
variable "kms_key_id" {
  type = string
}
variable "media_bucket_name" {
  type = string
}
variable "github_org" {
  type = string
}
variable "github_repo" {
  type        = string
  description = "GitHub repository name (without org prefix) for WIF scope"
}
variable "labels" {
  type    = map(string)
  default = {}
}

variable "cms_media_bucket_name" {
  type        = string
  description = "GCS bucket name for CMS media uploads"
}

variable "database_url_secret_name" {
  type        = string
  description = "Secret Manager secret name for DATABASE_URL — deploy SA needs read for migration step"
}

variable "firebase_project_id" {
  type        = string
  default     = ""
  description = "Firebase project ID for cross-project auth token verification. Empty disables the binding."
}
