################################################################################
# ElastiCache Module
################################################################################
locals {
  valkey_major_version = 8
}

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

module "valkey" {
  source  = "terraform-aws-modules/elasticache/aws"
  version = "1.4.1"

  replication_group_id = "${local.name}-valkey"

  engine         = "valkey"
  engine_version = "8.0"
  node_type      = "cache.m7g.large"

  transit_encryption_enabled = true
  auth_token                 = random_password.valkey.result
  maintenance_window         = "sun:05:00-sun:09:00"
  apply_immediately          = true

  # Security Group
  vpc_id = module.vpc.vpc_id
  security_group_rules = {
    ingress_vpc = {
      # Default type is `ingress`
      # Default port is based on the default engine port
      description = "VPC traffic"
      cidr_ipv4   = module.vpc.vpc_cidr_block
    }
  }

  # Subnet Group
  subnet_group_name        = "${local.name}-valkey"
  subnet_group_description = "${title(local.name)} subnet group"
  subnet_ids               = module.vpc.database_subnets

  # Parameter Group
  create_parameter_group      = true
  parameter_group_name        = "${local.name}-valkey-${local.valkey_major_version}"
  parameter_group_family      = "valkey8"
  parameter_group_description = "${title(local.name)} parameter group"
  parameters = [
    {
      name  = "latency-tracking"
      value = "yes"
    }
  ]

  tags = local.tags
}

module "valkey_serverless" {
  source  = "terraform-aws-modules/elasticache/aws//modules/serverless-cache"
  version = "1.4.1"

  engine               = "valkey"
  cache_name           = "${local.name}-valkey-serverless"
  major_engine_version = 8
  subnet_ids           = module.vpc.database_subnets

  security_group_ids = [
    module.valkey_sg.security_group_id
  ]
  user_group_id = module.elasticache_user_group.group_id
}
