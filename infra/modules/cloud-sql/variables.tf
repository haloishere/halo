variable "project_id" {
  type = string
}
variable "region" {
  type = string
}
variable "environment" {
  type = string
}
variable "instance_tier" {
  type    = string
  default = "db-f1-micro"
}
variable "vpc_self_link" {
  type = string
}
variable "kms_key_id" {
  type = string
}
variable "api_service_account" {
  type = string
}
variable "labels" {
  type    = map(string)
  default = {}
}

variable "private_service_connection_id" {
  type        = string
  description = "VPC private services connection ID — Cloud SQL must not be created before this exists"
}

variable "instance_suffix" {
  type        = string
  default     = ""
  description = "Optional suffix appended to instance name (e.g. 'v2') to avoid Cloud SQL name reservation after deletion"
}
