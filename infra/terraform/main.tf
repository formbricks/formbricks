locals {
  project     = "formbricks"
  environment = "prod"
  name        = "${local.project}-${local.environment}"
  vpc_cidr    = "10.0.0.0/16"
  azs         = slice(data.aws_availability_zones.available.names, 0, 3)
  tags = {
    Project     = local.project
    Environment = local.environment
    MangedBy    = "Terraform"
    Blueprint   = local.name
  }
  domain                 = "k8s.formbricks.com"
  karpetner_helm_version = "1.3.1"
  karpenter_namespace    = "karpenter"
}

################################################################################
# Route53 Hosted Zone
################################################################################
module "route53_zones" {
  source  = "terraform-aws-modules/route53/aws//modules/zones"
  version = "4.1.0"

  zones = {
    "k8s.formbricks.com" = {
      comment = "${local.domain} (testing)"
      tags = {
        Name = local.domain
      }
    }
  }
}

output "route53_ns_records" {
  value = module.route53_zones.route53_zone_name_servers
}


module "acm" {
  source  = "terraform-aws-modules/acm/aws"
  version = "5.1.1"

  domain_name = local.domain
  zone_id     = module.route53_zones.route53_zone_zone_id[local.domain]

  subject_alternative_names = [
    "*.${local.domain}",
  ]

  validation_method = "DNS"

  tags = local.tags
}

################################################################################
# VPC
################################################################################
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.19.0"

  name = "${local.name}-vpc"
  cidr = local.vpc_cidr

  azs                        = local.azs
  private_subnets            = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 4, k)]      # /20
  public_subnets             = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 8, k + 48)] # Public LB /24
  intra_subnets              = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 8, k + 52)] # eks interface /24
  database_subnets           = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 8, k + 56)] # RDS / Elastic cache /24
  database_subnet_group_name = "${local.name}-subnet-group"

  enable_nat_gateway = true
  single_nat_gateway = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
    # Tags subnets for Karpenter auto-discovery
    "karpenter.sh/discovery" = "${local.name}-eks"
  }

  tags = local.tags
}

################################################################################
# VPC Endpoints Module
################################################################################
module "vpc_vpc-endpoints" {
  source  = "terraform-aws-modules/vpc/aws//modules/vpc-endpoints"
  version = "5.19.0"

  vpc_id = module.vpc.vpc_id

  endpoints = {
    "s3" = {
      service      = "s3"
      service_type = "Gateway"
      route_table_ids = flatten([
        module.vpc.intra_route_table_ids,
        module.vpc.private_route_table_ids,
        module.vpc.public_route_table_ids
      ])
      tags = { Name = "s3-vpc-endpoint" }
    }
  }

  tags = local.tags
}

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

################################################################################
# ElastiCache Module
################################################################################
resource "random_password" "valkey" {
  length  = 20
  special = false
}

module "elasticache" {
  source  = "terraform-aws-modules/elasticache/aws"
  version = "1.4.1"

  replication_group_id = "${local.name}-valkey"

  engine         = "valkey"
  engine_version = "7.2"
  node_type      = "cache.t4g.small"

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
  parameter_group_name        = "${local.name}-valkey"
  parameter_group_family      = "valkey7"
  parameter_group_description = "${title(local.name)} parameter group"
  parameters = [
    {
      name  = "latency-tracking"
      value = "yes"
    }
  ]

  tags = local.tags
}

################################################################################
# EKS Module
################################################################################
module "ebs_csi_driver_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.52"

  role_name_prefix = "${local.name}-ebs-csi-driver-"

  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = local.tags
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.33.1"

  cluster_name    = "${local.name}-eks"
  cluster_version = "1.32"

  enable_cluster_creator_admin_permissions = true
  cluster_endpoint_public_access           = true

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    eks-pod-identity-agent = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent              = true
      service_account_role_arn = module.ebs_csi_driver_irsa.iam_role_arn
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    metrics-server = {
      most_recent = true
    }
  }

  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnets
  control_plane_subnet_ids = module.vpc.intra_subnets

  eks_managed_node_groups = {
    system = {
      ami_type       = "BOTTLEROCKET_ARM_64"
      instance_types = ["t4g.small"]

      min_size     = 2
      max_size     = 3
      desired_size = 2

      labels = {
        CriticalAddonsOnly        = "true"
        "karpenter.sh/controller" = "true"
      }

      taints = {
        addons = {
          key    = "CriticalAddonsOnly"
          value  = "true"
          effect = "NO_SCHEDULE"
        },
      }
    }
  }

  node_security_group_tags = merge(local.tags, {
    # NOTE - if creating multiple security groups with this module, only tag the
    # security group that Karpenter should utilize with the following tag
    # (i.e. - at most, only one security group should have this tag in your account)
    "karpenter.sh/discovery" = "${local.name}-eks"
  })

  tags = local.tags

}

module "karpenter" {
  source  = "terraform-aws-modules/eks/aws//modules/karpenter"
  version = "20.34.0"

  cluster_name          = module.eks.cluster_name
  enable_v1_permissions = true

  # Name needs to match role name passed to the EC2NodeClass
  node_iam_role_use_name_prefix   = false
  node_iam_role_name              = local.name
  create_pod_identity_association = true
  namespace                       = local.karpenter_namespace

  # Used to attach additional IAM policies to the Karpenter node IAM role
  node_iam_role_additional_policies = {
    AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  }

  tags = local.tags
}

output "karpenter_node_role" {
  value = module.karpenter.node_iam_role_name
}



resource "helm_release" "karpenter_crds" {
  name                = "karpenter-crds"
  repository          = "oci://public.ecr.aws/karpenter"
  repository_username = data.aws_ecrpublic_authorization_token.token.user_name
  repository_password = data.aws_ecrpublic_authorization_token.token.password
  chart               = "karpenter-crd"
  version             = "1.3.1"
  namespace           = local.karpenter_namespace
  values = [
    <<-EOT
    webhook:
      enabled: true
      serviceNamespace: ${local.karpenter_namespace}
    EOT
  ]
}

resource "helm_release" "karpenter" {
  name                = "karpenter"
  repository          = "oci://public.ecr.aws/karpenter"
  repository_username = data.aws_ecrpublic_authorization_token.token.user_name
  repository_password = data.aws_ecrpublic_authorization_token.token.password
  chart               = "karpenter"
  version             = "1.3.1"
  namespace           = local.karpenter_namespace
  skip_crds           = true

  values = [
    <<-EOT
    nodeSelector:
      karpenter.sh/controller: 'true'
    dnsPolicy: Default
    settings:
      clusterName: ${module.eks.cluster_name}
      clusterEndpoint: ${module.eks.cluster_endpoint}
      interruptionQueue: ${module.karpenter.queue_name}
    EOT
  ]
}

resource "kubernetes_manifest" "ec2_node_class" {
  manifest = {
    apiVersion = "karpenter.k8s.aws/v1"
    kind       = "EC2NodeClass"
    metadata = {
      name = "default"
    }
    spec = {
      amiSelectorTerms = [
        {
          alias = "bottlerocket@latest"
        }
      ]
      role = module.karpenter.node_iam_role_name
      subnetSelectorTerms = [
        {
          tags = {
            "karpenter.sh/discovery" = "${local.name}-eks"
          }
        }
      ]
      securityGroupSelectorTerms = [
        {
          tags = {
            "karpenter.sh/discovery" = "${local.name}-eks"
          }
        }
      ]
      tags = {
        "karpenter.sh/discovery" = "${local.name}-eks"
      }
    }
  }
}

resource "kubernetes_manifest" "node_pool" {
  manifest = {
    apiVersion = "karpenter.sh/v1"
    kind       = "NodePool"
    metadata = {
      name = "default"
    }
    spec = {
      template = {
        spec = {
          nodeClassRef = {
            group = "karpenter.k8s.aws"
            kind  = "EC2NodeClass"
            name  = "default"
          }
          requirements = [
            {
              key      = "karpenter.k8s.aws/instance-family"
              operator = "In"
              values   = ["c8g", "c7g", "m8g", "m7g", "r8g", "r7g"]
            },
            {
              key      = "karpenter.k8s.aws/instance-cpu"
              operator = "In"
              values   = ["2", "4", "8"]
            },
            {
              key      = "karpenter.k8s.aws/instance-hypervisor"
              operator = "In"
              values   = ["nitro"]
            }
          ]
        }
      }
      limits = {
        cpu = 10
      }
      disruption = {
        consolidationPolicy = "WhenEmpty"
        consolidateAfter    = "30s"
      }
    }
  }
}

module "eks_blueprints_addons" {
  source  = "aws-ia/eks-blueprints-addons/aws"
  version = "~> 1"

  cluster_name      = module.eks.cluster_name
  cluster_endpoint  = module.eks.cluster_endpoint
  cluster_version   = module.eks.cluster_version
  oidc_provider_arn = module.eks.oidc_provider_arn

  enable_aws_load_balancer_controller = true
  aws_load_balancer_controller = {
    chart_version = "1.10.0"
    values = [
      <<-EOT
      vpcId: ${module.vpc.vpc_id}
      EOT
    ]
  }
  enable_external_dns            = true
  external_dns_route53_zone_arns = [module.route53_zones.route53_zone_zone_arn[local.domain]]
  external_dns = {
    chart_version = "1.15.2"
  }
  enable_cert_manager = false
  cert_manager = {
    chart_version = "v1.17.1"
    values = [
      <<-EOT
      installCRDs: false
      crds:
        enabled: true
        keep: true
      EOT
    ]
  }

  enable_external_secrets = true
  external_secrets = {
    chart_version = "0.14.3"
  }

  tags = local.tags
}


module "iam_policy" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-policy"
  version = "5.53.0"

  name        = "formbricsk-policy"
  path        = "/"
  description = "Policy for fombricks app"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:*",
        ]
        Resource = "*"
      }
    ]
  })
}


module "formkey-aws-access" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "5.53.0"

  role_name_prefix = "formbricks"

  role_policy_arns = {
    "formbricks" = module.iam_policy.arn
  }

  oidc_providers = {
    eks = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["formbricks:*"]
    }
  }
}


resource "helm_release" "formbricks" {
  name      = "formbricks"
  namespace = "formbricks"
  chart     = "${path.module}/../../helm-chart"

  values = [
    <<-EOT
    postgresql:
      enabled: false
    redis:
      enabled: false
    ingress:
      enabled: true
      ingressClassName: alb
      hosts:
        - host: "app.${local.domain}"
          paths:
            - path: /
              pathType: "Prefix"
              serviceName: "formbricks"
      annotations:
        alb.ingress.kubernetes.io/scheme: internet-facing
        alb.ingress.kubernetes.io/target-type: ip
        alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
        alb.ingress.kubernetes.io/ssl-redirect: "443"
        alb.ingress.kubernetes.io/certificate-arn: ${module.acm.acm_certificate_arn}
        alb.ingress.kubernetes.io/healthcheck-path: "/health"
        alb.ingress.kubernetes.io/group.name: formbricks
        alb.ingress.kubernetes.io/ssl-policy: "ELBSecurityPolicy-TLS13-1-2-2021-06"
    secret:
      enabled: false
    rbac:
      enabled: true
      serviceAccount:
        enabled: true
        name: formbricks
        annotations:
          eks.amazonaws.com/role-arn: ${module.formkey-aws-access.iam_role_arn}
    deployment:
      env:
        EMAIL_VERIFICATION_DISABLED:
          value: "1"
        PASSWORD_RESET_DISABLED:
          value: "1"
      annotations:
        deployed_at: ${timestamp()}
    externalSecret:
      enabled: true  # Enable/disable ExternalSecrets
      secretStore:
        name: aws-secrets-manager
        kind: ClusterSecretStore
      refreshInterval: "1h"
      files:
        app-secrets:
          data:
            DATABASE_URL:
              remoteRef:
                key: "prod/formbricks/secrets"
                property: DATABASE_URL
            REDIS_URL:
              remoteRef:
                key: "prod/formbricks/secrets"
                property: REDIS_URL
            CRON_SECRET:
              remoteRef:
                key: "prod/formbricks/secrets"
                property: CRON_SECRET
            ENCRYPTION_KEY:
              remoteRef:
                key: "prod/formbricks/secrets"
                property: ENCRYPTION_KEY
            NEXTAUTH_SECRET:
              remoteRef:
                key: "prod/formbricks/secrets"
                property: NEXTAUTH_SECRET
            ENTERPRISE_LICENSE_KEY:
              remoteRef:
                key: "prod/formbricks/enterprise"
                property: ENTERPRISE_LICENSE_KEY
    EOT
  ]
}
