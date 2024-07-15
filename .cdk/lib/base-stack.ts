import {aws_ecr as ecr, aws_rds as rds, aws_s3 as s3, RemovalPolicy, Stack, StackProps} from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import {Construct} from 'constructs';
import {Credentials, DatabaseInstanceEngine, DatabaseSecret, PerformanceInsightRetention} from "aws-cdk-lib/aws-rds";

interface BaseStackProps extends StackProps {
    dbMaxAllocatedStorage: number;
    dbAllocatedStorage: number;
    dbInstanceType: string;
    dbName: string;
    projectName: string;
    environmentName: string;
}

export class BaseStack extends Stack {
    public readonly cluster: ecs.Cluster;
    public readonly bucket: s3.Bucket;
    public readonly vpc: ec2.IVpc;

    constructor(scope: Construct, id: string, props: BaseStackProps) {
        super(scope, id, props);

        const projectName = props.projectName;

        this.vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', {
            isDefault: true
        });

        this.cluster = new ecs.Cluster(this, `EcsCluster`, {
            clusterName: `${projectName}-cluster`,
            vpc: this.vpc
        });

        this.bucket = new s3.Bucket(this, `${projectName}-s3-bucket`, {
            bucketName: `${projectName}-assets-${props.environmentName}`,
        });

        if (props.environmentName === 'sandbox') {
            this.bucket.applyRemovalPolicy(RemovalPolicy.DESTROY);
        }

        const repository = new ecr.Repository(this, `Ecr`, {
            lifecycleRules: [{maxImageCount: 50}],
        });

        if (props.environmentName === 'sandbox') {
            repository.applyRemovalPolicy(RemovalPolicy.DESTROY);
        }

        const credsSecretName = `/${id}/rds/creds/${props.dbName}`.toLowerCase()

        const creds = new DatabaseSecret(this, 'PostgresRdsCredentials', {
            secretName: credsSecretName,
            username: 'postgres'
        })

        const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
            vpc: this.vpc,
            description: 'Allow DB port in',
            allowAllOutbound: true
        });

        dbSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(5432), "Allow all access");

        const dbInstance = new rds.DatabaseInstance(this, `${projectName}-db`, {
            engine: DatabaseInstanceEngine.postgres({version: rds.PostgresEngineVersion.VER_15}),
            vpc: this.vpc,
            credentials: Credentials.fromSecret(creds),
            allocatedStorage: props.dbAllocatedStorage,
            availabilityZone: this.vpc.availabilityZones[0],
            databaseName: props.dbName,
            publiclyAccessible: true,
            deleteAutomatedBackups: true,
            performanceInsightRetention: PerformanceInsightRetention.DEFAULT,
            instanceType: new ec2.InstanceType(props.dbInstanceType),
            maxAllocatedStorage: props.dbMaxAllocatedStorage,
            securityGroups: [dbSecurityGroup],
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            },
        });

        if (props.environmentName === 'sandbox') {
            dbInstance.applyRemovalPolicy(RemovalPolicy.DESTROY);
        }
    }
}
