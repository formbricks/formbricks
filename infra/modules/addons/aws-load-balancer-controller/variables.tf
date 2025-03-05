variable "addons_context" {
  description = "Context for the add-ons."
  type        = any
}

variable "tags" {
  description = "Tags to apply to the resources."
  type        = map(string)
  default     = {}
}

# https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.4/guide/targetgroupbinding/targetgroupbinding/#reference
# https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.4/deploy/installation/#setup-iam-manually
variable "attach_load_balancer_controller_targetgroup_binding_only_policy" {
  description = "Determines whether to attach the Load Balancer Controller policy for the TargetGroupBinding only"
  type        = bool
  default     = false
}

variable "load_balancer_controller_targetgroup_arns" {
  description = "List of Target groups ARNs using Load Balancer Controller"
  type        = list(string)
  default     = ["arn:aws:elasticloadbalancing:*:*:targetgroup/*/*"]
}
