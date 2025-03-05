variable "create" {
  description = "Create terraform resources"
  type        = bool
  default     = true
}
variable "argocd" {
  description = "argocd helm options"
  type        = any
  default     = {}
}
variable "install" {
  description = "Deploy argocd helm"
  type        = bool
  default     = true
}

variable "cluster" {
  description = "argocd cluster secret"
  type        = any
  default     = null
}

variable "apps" {
  description = "argocd app of apps to deploy"
  type        = any
  default     = {}
}
