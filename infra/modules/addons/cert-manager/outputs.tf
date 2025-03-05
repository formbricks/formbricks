output "gitops_metadata" {
  value = { for k, v in {
    iam_role_arn = module.cert_manager_iam_role.iam_role_arn
    namespace    = "cert-manager"
    } : "cert_manager_${k}" => v
  }
}
