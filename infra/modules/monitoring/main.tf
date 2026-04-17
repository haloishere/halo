resource "google_monitoring_uptime_check_config" "api_health" {
  display_name = "Halo API Health (${var.environment})"
  timeout      = "10s"
  period       = "60s"
  project      = var.project_id

  http_check {
    path         = "/healthz"
    port         = "443"
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = replace(var.cloud_run_url, "https://", "")
    }
  }
}

resource "google_logging_metric" "api_5xx" {
  name    = "halo-api-5xx-${var.environment}"
  project = var.project_id
  filter  = "resource.type=\"cloud_run_revision\" AND httpRequest.status>=500 AND resource.labels.service_name=\"halo-api-${var.environment}\""

  metric_descriptor {
    metric_kind  = "DELTA"
    value_type   = "INT64"
    unit         = "1"
    display_name = "Halo API 5xx Errors"
  }
}

resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "Halo API High Error Rate (${var.environment})"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "5xx error rate > 5%"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.api_5xx.name}\" AND resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "60s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = var.notification_channels
  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

resource "google_logging_project_sink" "audit_export" {
  name        = "halo-audit-export-${var.environment}"
  project     = var.project_id
  destination = "storage.googleapis.com/${var.audit_bucket}"
  filter      = "logName=~\"projects/${var.project_id}/logs/cloudaudit\""

  unique_writer_identity = true
}
