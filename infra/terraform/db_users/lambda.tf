resource "aws_lambda_layer_version" "psycopg2_layer" {
  layer_name          = "psycopg2-layer"
  description         = "Psycopg2 PostgreSQL driver for AWS Lambda"
  compatible_runtimes = ["python3.9"]
  filename            = "./lambda/deps/psycopg2-layer.zip"
}

module "lambda_rotate_db_secret" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "7.20.1"

  function_name      = "lbda-rotate-db-secret"
  description        = "Rotate Aurora Serverless PostgreSQL DB secret"
  handler            = "lambda_function.lambda_handler"
  source_path        = "./lambda/src/lambda_function.py"
  create_package     = true
  package_type       = "Zip"
  runtime            = "python3.9"
  timeout            = 30
  memory_size        = 128
  layers             = [aws_lambda_layer_version.psycopg2_layer.arn]
  create_role        = true
  role_name          = "iamr-lbda-rotate-db-secret-role"
  policy_name        = "iamp-lbda-rotate-db-secret-policy"
  attach_policy_json = true
  policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "kms:GenerateDataKey",
          "kms:Encrypt",
          "kms:DescribeKey",
          "kms:Decrypt"
        ]
        Effect   = "Allow"
        Resource = "*"
        Sid      = "AllowKMS"
      },
      {
        Action = [
          "secretsmanager:UpdateSecretVersionStage",
          "secretsmanager:PutSecretValue",
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Effect   = "Allow"
        Resource = "*"
        Sid      = "AllowSecretsManager"
      },
      {
        Action   = "secretsmanager:GetRandomPassword"
        Effect   = "Allow"
        Resource = "*"
        Sid      = "AllowSecretsManagerRandomPassword"
      }
    ]
  })
  tags = {
    Environment = "dev"
    Project     = "aurora-serverless"
    Zone        = "db-zone"
  }
}

resource "aws_lambda_permission" "AllowSecretsManager" {
  statement_id  = "AllowSecretsManager"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_rotate_db_secret.lambda_function_name
  principal     = "secretsmanager.amazonaws.com"
}
