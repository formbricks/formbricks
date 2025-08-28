provider "aws" {
  region = "eu-central-1"
}

terraform {
  backend "s3" {
    bucket         = "715841356175-terraform"
    key            = "formbricks/db_users/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "terraform-lock"
  }
}
