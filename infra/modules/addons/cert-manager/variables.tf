variable "addons_context" {
  description = "Context for the add-ons."
  type        = any
}

variable "tags" {
  description = "Tags to apply to the resources."
  type        = map(string)
  default     = {}
}

variable "cert_manager_route53_hosted_zone_arns" {
  description = "List of Route53 Hosted Zone ARNs used by cert-manager to create DNS records."
  type        = list(string)
  default     = ["arn:aws:route53:::hostedzone/*"]
}
