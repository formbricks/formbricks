locals {
  tags = merge(var.tags,
    {
      cluster_name = var.addons_context.cluster_name
      managedBy    = "terraform"
    }
  )
  karpenter_namespace = "karpenter"
}

module "karpenter" {
  source  = "terraform-aws-modules/eks/aws//modules/karpenter"
  version = "~> 20"

  cluster_name = var.addons_context.cluster_name

  enable_v1_permissions = true

  enable_pod_identity             = true
  create_pod_identity_association = true
  namespace                       = local.karpenter_namespace
  enable_irsa                     = false

  node_iam_role_additional_policies = merge({
    AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
    }
  )
}

