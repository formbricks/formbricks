locals {
  tags = merge(var.tags,
    {
      cluster_name = var.addons_context.cluster_name
      managedBy    = "terraform"
    }
  )
}


################################################################################
# IAM Role for cert-manager
################################################################################
module "cert_manager_iam_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5"

  role_name_prefix              = "cert-manager-"
  attach_cert_manager_policy    = true
  cert_manager_hosted_zone_arns = var.cert_manager_route53_hosted_zone_arns
  assume_role_condition_test    = "StringLike"
  oidc_providers = {
    eks = {
      provider_arn               = var.addons_context.oidc_provider_arn
      namespace_service_accounts = ["cert-manager:cert-manager"]
    }
  }

  tags = local.tags
}
