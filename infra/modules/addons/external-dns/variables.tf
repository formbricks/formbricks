variable "addons_context" {
  description = "Context for the add-ons."
  type        = any
}

variable "tags" {
  description = "Tags to apply to the resources."
  type        = map(string)
  default     = {}
}

variable "external_dns_hosted_zone_arns" {
  description = "Route53 hosted zone ARNs to allow External DNS to manage records"
  type        = list(string)
  default     = ["arn:aws:route53:::hostedzone/*"]
}
