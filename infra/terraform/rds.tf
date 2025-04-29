################################################################################
# PostgreSQL Serverless v2
################################################################################
data "aws_rds_engine_version" "postgresql" {
  engine  = "aurora-postgresql"
  version = "16.4"
}

moved {
  from = random_password.postgres
  to   = random_password.postgres["prod"]
}

resource "random_password" "postgres" {
  for_each = local.envs
  length   = 20
  special  = false
}

moved {
  from = module.rds-aurora
  to   = module.rds-aurora["prod"]
}

module "rds-aurora" {
  for_each = local.envs
  source   = "terraform-aws-modules/rds-aurora/aws"
  version  = "9.12.0"

  name                              = "${each.value}-postgres"
  engine                            = data.aws_rds_engine_version.postgresql.engine
  engine_mode                       = "provisioned"
  engine_version                    = data.aws_rds_engine_version.postgresql.version
  storage_encrypted                 = true
  master_username                   = "formbricks"
  master_password                   = random_password.postgres[each.key].result
  manage_master_user_password       = false
  create_db_cluster_parameter_group = true
  db_cluster_parameter_group_family = data.aws_rds_engine_version.postgresql.parameter_group_family
  db_cluster_parameter_group_parameters = [
    {
      name         = "shared_preload_libraries"
      value        = "pglogical"
      apply_method = "pending-reboot"
    }
  ]

  vpc_id               = module.vpc.vpc_id
  db_subnet_group_name = module.vpc.database_subnet_group_name
  security_group_rules = {
    vpc_ingress = {
      cidr_blocks = module.vpc.private_subnets_cidr_blocks
    }
  }
  performance_insights_enabled         = true
  cluster_performance_insights_enabled = true

  backup_retention_period = 7
  apply_immediately       = true
  skip_final_snapshot     = false

  deletion_protection = true

  enable_http_endpoint = true

  serverlessv2_scaling_configuration = {
    min_capacity             = 0
    max_capacity             = 50
    seconds_until_auto_pause = 3600
  }

  instance_class = "db.serverless"

  instances = {
    one = {}
  }

  tags = local.tags_map[each.key]

}
