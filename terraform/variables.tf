variable "cloudflare_zone_id" {
  description = "Zone ID for kelliher.info (found in Cloudflare dashboard)"
  type        = string
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
  sensitive   = true
}

variable "cloudflare_token_file" {
  description = "Path to file containing Cloudflare API token"
  type        = string
  default     = "~/.secrets/cloudflaretoken"
}
