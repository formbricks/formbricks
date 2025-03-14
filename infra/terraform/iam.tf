################################################################################
# GitHub OIDC Provider
# Note: This is one per AWS account
################################################################################
module "iam_github_oidc_provider" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-github-oidc-provider"
  version = "5.54.0"

  tags = local.tags
}

################################################################################
# GitHub OIDC Role
################################################################################

module "iam_github_oidc_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-github-oidc-role"
  version = "5.54.0"

  name = "${local.name}-github"

  subjects = [
    "repo:formbricks/*:*",
  ]
  policies = {
    Administrator = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
  }

  tags = local.tags
}
