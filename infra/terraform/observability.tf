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
      namespace_service_accounts = ["monitoring:*loki*"]
    }
  }
}

module "observability_grafana_iam_policy" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-policy"
  version = "5.53.0"

  name_prefix = "grafana-"
  path        = "/"
  description = "Policy for Formbricks observability apps - Grafana"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowReadingMetricsFromCloudWatch"
        Effect = "Allow"
        Action = [
          "cloudwatch:DescribeAlarmsForMetric",
          "cloudwatch:DescribeAlarmHistory",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:ListMetrics",
          "cloudwatch:GetMetricData",
          "cloudwatch:GetInsightRuleReport"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowReadingResourceMetricsFromPerformanceInsights"
        Effect = "Allow"
        Action = "pi:GetResourceMetrics"
        Resource = "*"
      },
      {
        Sid    = "AllowReadingLogsFromCloudWatch"
        Effect = "Allow"
        Action = [
          "logs:DescribeLogGroups",
          "logs:GetLogGroupFields",
          "logs:StartQuery",
          "logs:StopQuery",
          "logs:GetQueryResults",
          "logs:GetLogEvents"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowReadingTagsInstancesRegionsFromEC2"
        Effect = "Allow"
        Action = [
          "ec2:DescribeTags",
          "ec2:DescribeInstances",
          "ec2:DescribeRegions"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowReadingResourcesForTags"
        Effect = "Allow"
        Action = "tag:GetResources"
        Resource = "*"
      }
    ]
  })
}

module "observability_grafana_iam_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "5.53.0"

  role_name_prefix = "grafana-"

  role_policy_arns = {
    "formbricks" = module.observability_grafana_iam_policy.arn
  }
  assume_role_condition_test = "StringLike"

  oidc_providers = {
    eks = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["monitoring:grafana"]
    }
  }
}
