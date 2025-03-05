output "gitops_metadata" {
  description = "GitOps Bridge metadata"
  value = merge(
    try(module.cert_manager[0].gitops_metadata, {}),
    try(module.external_dns[0].gitops_metadata, {}),
    try(module.external_secrets[0].gitops_metadata, {}),
    try(module.aws_load_balancer_controller[0].gitops_metadata, {}),
    try(module.karpenter[0].gitops_metadata, {}),
#     try(module.keda[0].gitops_metadata, {}),
#     try(module.velero[0].gitops_metadata, {}),
#     try(module.observability[0].gitops_metadata, {}),
  )
}
