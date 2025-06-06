provider "aws" {
  region = "eu-central-1"
}

provider "aws" {
  region = "us-east-1"
  alias  = "virginia"
}

terraform {
  backend "s3" {
    bucket         = "715841356175-terraform"
    key            = "terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "terraform-lock"
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  token                  = data.aws_eks_cluster_auth.eks.token
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    token                  = data.aws_eks_cluster_auth.eks.token
  }
}
