################################################################################
# PostgreSQL Serverless v2
################################################################################
data "aws_rds_engine_version" "postgresql" {
  engine  = "aurora-postgresql"
  version = "16.4"
}

resource "random_password" "postgres" {
  length  = 20
  special = false
}

module "rds-aurora" {
  source  = "terraform-aws-modules/rds-aurora/aws"
  version = "9.12.0"

  name                        = "${local.name}-postgres"
  engine                      = data.aws_rds_engine_version.postgresql.engine
  engine_mode                 = "provisioned"
  engine_version              = data.aws_rds_engine_version.postgresql.version
  storage_encrypted           = true
  master_username             = "formbricks"
  master_password             = random_password.postgres.result
  manage_master_user_password = false

  vpc_id               = module.vpc.vpc_id
  db_subnet_group_name = module.vpc.database_subnet_group_name
  security_group_rules = {
    vpc_ingress = {
      cidr_blocks = module.vpc.private_subnets_cidr_blocks
    }
  }
  performance_insights_enabled = true

  apply_immediately   = true
  skip_final_snapshot = true

  enable_http_endpoint = true

  serverlessv2_scaling_configuration = {
    min_capacity             = 0
    max_capacity             = 10
    seconds_until_auto_pause = 3600
  }

  instance_class = "db.serverless"

  instances = {
    one = {}
  }

  tags = local.tags

}
