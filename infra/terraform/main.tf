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
  domain = "k8s.formbricks.com"
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
  version = "14.12"
}

module "rds-aurora" {
  source  = "terraform-aws-modules/rds-aurora/aws"
  version = "9.12.0"

  count = var.enable_rds_aurora ? 1 : 0

  name              = "${local.name}-postgres"
  engine            = data.aws_rds_engine_version.postgresql.engine
  engine_mode       = "provisioned"
  engine_version    = data.aws_rds_engine_version.postgresql.version
  storage_encrypted = true
  master_username   = "postgres"

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
