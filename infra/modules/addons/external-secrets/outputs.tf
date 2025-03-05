output "gitops_metadata" {
  value = { for k, v in {
    iam_role_arn = module.external_secrets_irsa_role.iam_role_arn
    namespace    = "external_secrets"
    } : "external_secrets_${k}" => v
  }
}
