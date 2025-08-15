resource "aws_sns_topic" "this" {
  name = "lambda-metrics-alarm"
}

module "alarm" {
  source  = "terraform-aws-modules/cloudwatch/aws//modules/metric-alarm"
  version = "~> 3.0"

  alarm_name          = "lambda-duration-lbda-rotate-db-secret"
  alarm_description   = "Lambda duration is too high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 10
  period              = 60
  unit                = "Milliseconds"

  namespace   = "AWS/Lambda"
  metric_name = "Duration"
  statistic   = "Maximum"

  dimensions = {
    FunctionName = module.lambda_rotate_db_secret.lambda_function_name
  }

  alarm_actions = [aws_sns_topic.this.arn]
}

module "alarm_metric_query" {
  source  = "terraform-aws-modules/cloudwatch/aws//modules/metric-alarm"
  version = "~> 3.0"

  alarm_name          = "mq-lambda-duration-lbda-rotate-db-secret"
  alarm_description   = "Lambda error rate is too high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 10

  metric_query = [{
    id = "e1"

    return_data = true
    expression  = "m2/m1*100"
    label       = "Error Rate"
    }, {
    id = "m1"

    metric = [{
      namespace   = "AWS/Lambda"
      metric_name = "Invocations"
      period      = 60
      stat        = "Sum"
      unit        = "Count"

      dimensions = {
        FunctionName = module.lambda_rotate_db_secret.lambda_function_name
      }
    }]
    }, {
    id = "m2"

    metric = [{
      namespace   = "AWS/Lambda"
      metric_name = "Errors"
      period      = 60
      stat        = "Sum"
      unit        = "Count"

      dimensions = {
        FunctionName = module.lambda_rotate_db_secret.lambda_function_name
      }
    }]
  }]

  alarm_actions = [aws_sns_topic.this.arn]

  tags = {
    Secure = "maybe"
  }
}

module "alarm_anomaly" {
  source  = "terraform-aws-modules/cloudwatch/aws//modules/metric-alarm"
  version = "~> 3.0"

  alarm_name          = "lambda-invocations-anomaly-lbda-rotate-db-secret"
  alarm_description   = "Lambda invocations anomaly"
  comparison_operator = "LessThanLowerOrGreaterThanUpperThreshold"
  evaluation_periods  = 1
  threshold_metric_id = "ad1"

  metric_query = [{
    id = "ad1"

    return_data = true
    expression  = "ANOMALY_DETECTION_BAND(m1, 2)"
    label       = "Invocations (expected)"
    return_data = "true"
    },
    {
      id = "m1"

      metric = [{
        namespace   = "AWS/Lambda"
        metric_name = "Invocations"
        period      = 60
        stat        = "Sum"
        unit        = "Count"

        dimensions = {
          FunctionName = module.lambda_rotate_db_secret.lambda_function_name
        }
      }]
      return_data = "true"
  }]

  alarm_actions = [aws_sns_topic.this.arn]

  tags = {
    Secure = "maybe"
  }
}
