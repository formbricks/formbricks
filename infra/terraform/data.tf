data "aws_region" "selected" {}
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {}
data "aws_partition" "current" {}

data "aws_eks_cluster_auth" "eks" {
  name = module.eks.cluster_name
}

data "aws_ecrpublic_authorization_token" "token" {
  provider = aws.virginia
}

data "aws_iam_roles" "administrator" {
  name_regex = "AWSReservedSSO_AdministratorAccess"
}

data "aws_iam_roles" "github" {
  name_regex = "formbricks-prod-github"
}

data "aws_acm_certificate" "formbricks" {
  domain = local.domain
}
