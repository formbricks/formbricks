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

moved {
  from = module.valkey
  to   = module.valkey["prod"]
}

module "valkey" {
  for_each = local.envs
  source   = "terraform-aws-modules/elasticache/aws"
  version  = "1.4.1"

  replication_group_id = "${each.value}-valkey"

  engine         = "valkey"
  engine_version = "8.0"
  node_type      = "cache.m7g.large"

  transit_encryption_enabled = true
  auth_token                 = random_password.valkey[each.key].result
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

  log_delivery_configuration = {
    slow-log = {
      destination_type                       = "cloudwatch-logs"
      log_format                             = "json"
      cloudwatch_log_group_retention_in_days = 365
    }
  }

  # Subnet Group
  subnet_group_name        = "${each.value}-valkey"
  subnet_group_description = "${title(each.value)} subnet group"
  subnet_ids               = module.vpc.database_subnets

  # Parameter Group
  create_parameter_group      = true
  parameter_group_name        = "${each.value}-valkey-${local.valkey_major_version}"
  parameter_group_family      = "valkey8"
  parameter_group_description = "${title(each.value)} parameter group"
  parameters = [
    {
      name  = "latency-tracking"
      value = "yes"
    }
  ]

  tags = local.tags_map[each.key]
}
