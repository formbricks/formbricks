locals {
  tags = merge(var.tags,
    {
      cluster_name = var.addons_context.cluster_name
      managedBy    = "terraform"
    }
  )
}


################################################################################
# IAM Role for external-dns
################################################################################
module "external_dns_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5"

  role_name_prefix           = "external-dns-"
  attach_external_dns_policy = true

  external_dns_hosted_zone_arns = var.external_dns_hosted_zone_arns

  oidc_providers = {
    eks = {
      provider_arn               = var.addons_context.oidc_provider_arn
      namespace_service_accounts = ["external-dns:external-dns"]
    }
  }

  tags = local.tags
}
