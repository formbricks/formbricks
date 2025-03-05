output "gitops_metadata" {
  value = { for k, v in {
    iam_role_arn = module.load_balancer_controller_irsa_role.iam_role_arn
    } : "aws_load_balancer_controller_${k}" => v
  }
}
