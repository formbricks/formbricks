data "aws_region" "selected" {}

data "aws_secretsmanager_secret" "rds_credentials" {
  arn = data.terraform_remote_state.main.outputs.rds_secret_staging_arn
}

# Default KMS key for Secrets Manager
data "aws_kms_key" "secretsmanager" {
  key_id = "alias/aws/secretsmanager"
}

data "terraform_remote_state" "main" {
  backend = "s3"

  config = {
    bucket = "715841356175-terraform"
    key    = "terraform.tfstate"
    region = "eu-central-1"
  }
}
