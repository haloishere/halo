variable "project_id" {
  type = string
}
variable "region" {
  type = string
}
variable "environment" {
  type = string
}
variable "cloud_run_url" {
  type = string
}
variable "audit_bucket" {
  type = string
}
variable "notification_channels" {
  description = "List of notification channel IDs for alert policies"
  type        = list(string)
  default     = []
}
variable "labels" {
  type    = map(string)
  default = {}
}
