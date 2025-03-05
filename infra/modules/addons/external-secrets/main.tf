locals {
  tags = merge(var.tags,
    {
      cluster_name = var.addons_context.cluster_name
      managedBy    = "terraform"
    }
  )
}

################################################################################
# IAM Role for external-secrets
################################################################################
module "external_secrets_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5"

  role_name_prefix                                   = "external-secrets-"
  attach_external_secrets_policy                     = true
  external_secrets_ssm_parameter_arns                = var.external_secrets_ssm_parameter_arns
  external_secrets_secrets_manager_arns              = var.external_secrets_secrets_manager_arns
  external_secrets_kms_key_arns                      = var.external_secrets_kms_key_arns
  external_secrets_secrets_manager_create_permission = var.external_secrets_secrets_manager_create_permission

  oidc_providers = {
    eks = {
      provider_arn               = var.addons_context.oidc_provider_arn
      namespace_service_accounts = ["external-secrets:external-secrets"]
    }
  }

  tags = local.tags
}
