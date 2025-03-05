variable "enable_rds_aurora" {
  description = "Enable RDS Aurora PostgreSQL Serverless v2"
  type        = bool
  default     = false
}

###############################################
# EKS Addons Configuration
###############################################
variable "addons_repo_url" {
  description = "URL of the EKS Addons Helm repository."
  type        = string
  default     = "https://github.com/d3vb0ox/formbricks"
}

variable "addons_target_revision" {
  description = "The target revision of the EKS Addons Helm repository."
  type        = string
  default     = "main"
}

variable "addons_repo_path" {
  description = "Path to the EKS Addons Helm repository."
  type        = string
  default     = "infra/bootstrap/charts/eks-addons"
}

variable "cert_manager_helm_config" {
  description = "Configuration for the cert-manager add-on."
  type        = any
  default     = {}
}
variable "external_dns_helm_config" {
  description = "Configuration for the External DNS add-on."
  type        = any
  default     = {}
}
variable "karpenter_helm_config" {
  description = "Configuration for the Karpenter add-on."
  type        = any
  default     = {}
}
variable "external_secrets_helm_config" {
  description = "Configuration for the External Secrets add-on."
  type        = any
  default     = {}
}
variable "metrics_server_helm_config" {
  description = "Configuration for the Metrics Server add-on."
  type        = any
  default     = {}
}
variable "keda_helm_config" {
  description = "Configuration for the Keda add-on."
  type        = any
  default     = {}
}
variable "istio_helm_config" {
  description = "Configuration for the Istio add-on."
  type        = any
  default     = {}
}
variable "aws_load_balancer_controller_helm_config" {
  description = "Configuration for the AWS Load Balancer Controller add-on."
  type        = any
  default     = {}
}

variable "velero_helm_config" {
  description = "Configuration for the Velero add-on."
  type        = any
  default     = {}
}

variable "observability_helm_config" {
  description = "Configuration for the Truemark Observability add-on."
  type        = any
  default     = {}
}

variable "castai_helm_config" {
  description = "Configuration for the Castai add-on."
  type        = any
  default     = {}
}
