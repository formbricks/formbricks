output "gitops_metadata" {
  value = { for k, v in {
    iam_role_arn = module.external_dns_irsa_role.iam_role_arn
    namespace    = "external-dns"
    } : "external_dns_${k}" => v
  }
}
