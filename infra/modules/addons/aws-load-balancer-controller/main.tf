locals {
  tags = merge(var.tags,
    {
      cluster_name = var.addons_context.cluster_name
      managedBy    = "terraform"
    }
  )
}


module "load_balancer_controller_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5"

  role_name_prefix                       = "load-balancer-controller-"
  attach_load_balancer_controller_policy = true

  oidc_providers = {
    eks = {
      provider_arn               = var.addons_context.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller-sa"]
    }
  }

  tags = local.tags
}
