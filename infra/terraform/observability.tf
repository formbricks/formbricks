module "loki_s3_bucket" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "4.6.0"

  bucket_prefix            = "loki-"
  force_destroy            = true
  control_object_ownership = true
  object_ownership         = "BucketOwnerPreferred"
}

module "observability_loki_iam_policy" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-policy"
  version = "5.53.0"

  name_prefix = "loki-"
  path        = "/"
  description = "Policy for fombricks observability apps"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:*",
        ]
        Resource = [
          module.loki_s3_bucket.s3_bucket_arn,
          "${module.loki_s3_bucket.s3_bucket_arn}/*"
        ]
      }
    ]
  })
}


module "observability_loki_iam_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "5.53.0"

  role_name_prefix = "loki-"

  role_policy_arns = {
    "formbricks" = module.observability_loki_iam_policy.arn
  }
  assume_role_condition_test = "StringLike"

  oidc_providers = {
    eks = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["monitoring:loki*"]
    }
  }
}
