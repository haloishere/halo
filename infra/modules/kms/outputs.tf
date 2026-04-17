output "key_id" {
  description = "KMS crypto key resource ID"
  value       = google_kms_crypto_key.dek_kek.id
}

output "keyring_id" {
  description = "KMS key ring resource ID"
  value       = google_kms_key_ring.halo.id
}
