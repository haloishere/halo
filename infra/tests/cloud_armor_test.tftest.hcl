variables {
  project_id  = "halo-test"
  environment = "development"
  labels      = { app = "halo", environment = "development", managed_by = "terraform" }
}

run "throttle_rule_action" {
  command = plan

  module {
    source = "./modules/cloud-armor"
  }

  assert {
    # Filter by priority so this assertion is stable if new rules are added.
    condition     = [for r in google_compute_security_policy.halo.rule : r if r.priority == 1000][0].action == "throttle"
    error_message = "Rate-limit rule (priority 1000) must use action = throttle, not deny"
  }
}

run "throttle_rule_denies_429" {
  command = plan

  module {
    source = "./modules/cloud-armor"
  }

  assert {
    condition     = [for r in google_compute_security_policy.halo.rule : r if r.priority == 1000][0].rate_limit_options[0].exceed_action == "deny(429)"
    error_message = "Throttle rule must deny with 429 on rate limit exceed"
  }
}

run "xss_rule_uses_owasp_expr" {
  command = plan

  module {
    source = "./modules/cloud-armor"
  }

  assert {
    condition     = [for r in google_compute_security_policy.halo.rule : r if r.priority == 2000][0].match[0].expr[0].expression == "evaluatePreconfiguredExpr('xss-stable')"
    error_message = "XSS rule (priority 2000) must use OWASP xss-stable preconfigured expression"
  }
}

run "sqli_rule_uses_owasp_expr" {
  command = plan

  module {
    source = "./modules/cloud-armor"
  }

  assert {
    condition     = [for r in google_compute_security_policy.halo.rule : r if r.priority == 2001][0].match[0].expr[0].expression == "evaluatePreconfiguredExpr('sqli-stable')"
    error_message = "SQLi rule (priority 2001) must use OWASP sqli-stable preconfigured expression"
  }
}

run "default_rule_allows_all" {
  command = plan

  module {
    source = "./modules/cloud-armor"
  }

  assert {
    condition     = [for r in google_compute_security_policy.halo.rule : r if r.priority == 2147483647][0].action == "allow"
    error_message = "Default rule (lowest priority 2147483647) must allow remaining traffic"
  }
}
