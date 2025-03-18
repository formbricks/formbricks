################################################################################
# ElastiCache Module
################################################################################
resource "random_password" "valkey" {
  length  = 20
  special = false
}
resource "random_password" "valkey_default_user" {
  length  = 20
  special = false
}

module "valkey_sg" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "~> 5.0"

  name        = "valkey-sg"
  description = "Security group for VPC traffic"
  vpc_id      = module.vpc.vpc_id

  ingress_cidr_blocks = [module.vpc.vpc_cidr_block]
  ingress_rules       = ["redis-tcp"]

  tags = local.tags
}

module "elasticache_user_group" {
  source  = "terraform-aws-modules/elasticache/aws//modules/user-group"
  version = "1.4.1"

  user_group_id       = "${local.name}-valkey"
  create_default_user = false
  default_user = {
    user_id   = "formbricks-default"
    passwords = [random_password.valkey_default_user.result]
  }
  users = {
    formbricks = {
      access_string = "on ~* +@all"
      passwords     = [random_password.valkey.result]
    }
  }
  engine = "redis"
  tags = merge(local.tags, {
    terraform-aws-modules = "elasticache"
  })
}

module "valkey_serverless" {
  source  = "terraform-aws-modules/elasticache/aws//modules/serverless-cache"
  version = "1.4.1"

  engine     = "valkey"
  cache_name = "${local.name}-valkey-serverless"
  cache_usage_limits = {
    data_storage = {
      maximum = 2
    }
    ecpu_per_second = {
      maximum = 1000
    }
  }
  major_engine_version = 7
  subnet_ids           = module.vpc.database_subnets

  security_group_ids = [
    module.valkey_sg.security_group_id
  ]
  user_group_id = module.elasticache_user_group.group_id
}
