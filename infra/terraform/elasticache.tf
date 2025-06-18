################################################################################
# ElastiCache Module
################################################################################
locals {
  valkey_major_version = 8
}

moved {
  from = random_password.valkey
  to   = random_password.valkey["prod"]
}

resource "random_password" "valkey" {
  for_each = local.envs
  length   = 20
  special  = false
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
  for_each = local.envs
  source   = "terraform-aws-modules/elasticache/aws//modules/user-group"
  version  = "1.4.1"

  user_group_id       = "${each.value}-valkey"
  create_default_user = false
  default_user = {
    user_id   = each.value
    passwords = [random_password.valkey[each.key].result]
  }
  users = {
    "${each.value}" = {
      access_string = "on ~* +@all"
      passwords     = [random_password.valkey[each.key].result]
    }
  }
  engine = "redis"
  tags = merge(local.tags, {
    terraform-aws-modules = "elasticache"
  })
}

module "valkey_serverless" {
  for_each = local.envs
  source   = "terraform-aws-modules/elasticache/aws//modules/serverless-cache"
  version  = "1.4.1"

  engine               = "valkey"
  cache_name           = "${each.value}-valkey-serverless"
  major_engine_version = local.valkey_major_version
  # cache_usage_limits = {
  #   data_storage = {
  #     maximum = 2
  #   }
  #   ecpu_per_second = {
  #     maximum = 1000
  #   }
  # }
  subnet_ids = module.vpc.database_subnets

  security_group_ids = [
    module.valkey_sg.security_group_id
  ]
  user_group_id = module.elasticache_user_group[each.key].group_id
}
