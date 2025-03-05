output "gitops_metadata" {
  value = { for k, v in {
    iam_role_arn       = module.karpenter.iam_role_arn
    node_iam_role_arn  = module.karpenter.node_iam_role_name
    interruption_queue = module.karpenter.queue_name
    namespace          = local.karpenter_namespace
    } : "karpenter_${k}" => v
  }
}
