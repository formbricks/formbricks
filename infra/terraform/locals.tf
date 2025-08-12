locals {
  project     = "formbricks"
  environment = "prod"
  name        = "${local.project}-${local.environment}"
  envs = {
    prod  = "${local.project}-prod"
    stage = "${local.project}-stage"
  }
  vpc_cidr = "10.0.0.0/16"
  azs      = slice(data.aws_availability_zones.available.names, 0, 3)
  tags = {
    Project     = local.project
    Environment = local.environment
    ManagedBy   = "Terraform"
    Blueprint   = local.name
  }
  tags_map = {
    prod = {
      Project     = local.project
      Environment = "prod"
      ManagedBy   = "Terraform"
      Blueprint   = "${local.project}-prod"
    }
    stage = {
      Project     = local.project
      Environment = "stage"
      ManagedBy   = "Terraform"
      Blueprint   = "${local.project}-stage"
    }
  }
  domain                 = "k8s.formbricks.com"
  karpetner_helm_version = "1.3.1"
  karpenter_namespace    = "karpenter"
}
