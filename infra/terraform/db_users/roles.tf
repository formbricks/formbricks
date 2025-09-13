module "create_postgres_user_read_only_role" {

  source  = "digitickets/cli/aws"
  version = "7.0.0"

  role_session_name = "CreatePostgresUserRoles"
  aws_cli_commands = [
    "rds-data", "execute-statement",
    format("--resource-arn=%s", data.terraform_remote_state.main.outputs.rds["stage"].cluster_arn),
    format("--secret-arn=%s", data.aws_secretsmanager_secret.rds_credentials.arn),
    format("--region=%s", data.aws_region.selected.name),
    format("--database=%s", local.rds_database_name),
    format("--sql=\"%s\"", local.sql_create_read_only_role.sql)
  ]
}

module "create_postgres_user_read_write_role" {

  source  = "digitickets/cli/aws"
  version = "7.0.0"

  role_session_name = "CreatePostgresUserRoles"
  aws_cli_commands = [
    "rds-data", "execute-statement",
    format("--resource-arn=%s", data.terraform_remote_state.main.outputs.rds["stage"].cluster_arn),
    format("--secret-arn=%s", data.aws_secretsmanager_secret.rds_credentials.arn),
    format("--region=%s", data.aws_region.selected.name),
    format("--database=%s", local.rds_database_name),
    format("--sql=\"%s\"", local.sql_create_read_write_role.sql)
  ]

  depends_on = [
    module.create_postgres_user_read_only_role
  ]
}

module "create_postgres_user_admin_role" {

  source  = "digitickets/cli/aws"
  version = "7.0.0"

  role_session_name = "CreatePostgresUserRoles"
  aws_cli_commands = [
    "rds-data", "execute-statement",
    format("--resource-arn=%s", data.terraform_remote_state.main.outputs.rds["stage"].cluster_arn),
    format("--secret-arn=%s", data.aws_secretsmanager_secret.rds_credentials.arn),
    format("--region=%s", data.aws_region.selected.name),
    format("--database=%s", local.rds_database_name),
    format("--sql=\"%s\"", local.sql_create_admin_role.sql)
  ]

  depends_on = [
    module.create_postgres_user_read_write_role
  ]
}

# Create a SQL users
module "create_postgres_user" {
  for_each = {
    for user, user_info in local.sql_users_map :
    user => user_info
    if var.env_name != "localstack"
  }

  source  = "digitickets/cli/aws"
  version = "7.0.0"

  role_session_name = "CreatePostgresUser"
  aws_cli_commands = [
    "rds-data", "execute-statement",
    format("--resource-arn=%s", data.terraform_remote_state.main.outputs.rds["stage"].cluster_arn),
    format("--secret-arn=%s", data.aws_secretsmanager_secret.rds_credentials.arn),
    format("--region=%s", data.aws_region.selected.name),
    format("--database=%s", local.rds_database_name),
    format("--sql=\"%s\"", local.sql_create_user[each.key].sql)
  ]
}
