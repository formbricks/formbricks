import {
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecs_patterns as ecsPatterns,
    aws_iam as iam,
    aws_efs as efs,
    aws_s3 as s3,
    CfnOutput, IgnoreMode,
    RemovalPolicy,
    Stack,
    StackProps, Duration, aws_lambda, aws_logs_destinations, aws_logs
} from 'aws-cdk-lib';
import * as elasticcache from "aws-cdk-lib/aws-elasticache";
import {Construct} from 'constructs';
import {LogGroup, SubscriptionFilter} from "aws-cdk-lib/aws-logs";
import {DockerImageAsset} from "aws-cdk-lib/aws-ecr-assets";
import {Certificate} from "aws-cdk-lib/aws-certificatemanager";
import {AccessPoint} from "aws-cdk-lib/aws-efs";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";

interface ECSStackProps extends StackProps {
    cluster: ecs.Cluster,
    bucket: s3.Bucket;
    vpc: ec2.IVpc;
    taskCPU: number;
    taskMemory: number;
    projectName: string;
    environmentName: string;
    certificateArn: string;
    envFileName: string;
    cacheNodeType: string;
}

export class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: ECSStackProps) {
        super(scope, id, props);

        const projectName = props.projectName;

        const fileSystem = new efs.FileSystem(this, 'EfsFileSystem', {
            vpc: props.vpc,
            performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
            throughputMode: efs.ThroughputMode.BURSTING,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const accessPoint = new AccessPoint(this, 'AccessPoint', {
            fileSystem: fileSystem,
            path: "/data",
            createAcl: {
                ownerGid: "1001",
                ownerUid: "1001",
                permissions: "755"
            },
            posixUser: {
                uid: "1001",
                gid: "1001"
            }
        });

        const taskRole = new iam.Role(this, `${projectName}-task-role`, {
            assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            description: "Role that the task definitions when running the code",
        });

        taskRole.attachInlinePolicy(
            new iam.Policy(this, `${projectName}-task-policy`, {
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["S3:*"],
                        resources: [props.bucket.bucketArn, props.bucket.bucketArn + "/*"],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: [
                            'elasticfilesystem:ClientMount',
                            'elasticfilesystem:ClientWrite',
                            'elasticfilesystem:DescribeFileSystems',
                            'elasticfilesystem:DescribeMountTargets',
                        ],
                        resources: [fileSystem.fileSystemArn],
                    })
                ],
            })
        );

        const webTask = new ecs.FargateTaskDefinition(this, `${projectName}-web`, {
            family: `${projectName}-web`,
            memoryLimitMiB: props.taskMemory,
            cpu: props.taskCPU,
            taskRole: taskRole,
            runtimePlatform: {
                operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
                cpuArchitecture: ecs.CpuArchitecture.ARM64,
            },
            volumes: [
                {
                    name: "efs-volume",
                    efsVolumeConfiguration: {
                        fileSystemId: fileSystem.fileSystemId,
                        transitEncryption: 'ENABLED',
                        authorizationConfig: {
                            iam: 'ENABLED',
                            accessPointId: accessPoint.accessPointId,
                        }
                    }
                }
            ]
        });

        webTask.addToExecutionRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["S3:GetObject"],
            resources: [props.bucket.bucketArn + "/" + props.envFileName],
        }));

        webTask.addToExecutionRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["S3:GetBucketLocation"],
            resources: [props.bucket.bucketArn],
        }));


        const webLogGroup = new LogGroup(this, `/ecs/${projectName}/web`, {
            retention: 60,
            logGroupName: `/ecs/${projectName}/web`
        });

        if (props.environmentName === 'sandbox') {
            webLogGroup.applyRemovalPolicy(RemovalPolicy.DESTROY);
        }

        const dockerImageAsset = new DockerImageAsset(this, 'OpinodoSurveysDockerImage', {
            directory: '../', // Specify the context directory
            file: './apps/web/Dockerfile',
            ignoreMode: IgnoreMode.DOCKER,
        });

        const webContainer = webTask.addContainer('web', {
            image: ecs.EcrImage.fromDockerImageAsset(dockerImageAsset),
            essential: true,
            containerName: 'web',
            environmentFiles: [
                ecs.EnvironmentFile.fromBucket(props.bucket, props.envFileName),
            ],
            logging: ecs.LogDriver.awsLogs({streamPrefix: `ecs`, logGroup: webLogGroup}),
            portMappings: [{containerPort: 3000}],
        });

        webContainer.addMountPoints({
            sourceVolume: 'efs-volume',
            containerPath: '/home/nextjs/apps/web/uploads',
            readOnly: false
        });

        const webService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, `${projectName}-web-service`, {
            cluster: props.cluster,
            desiredCount: 1,
            taskDefinition: webTask,
            serviceName: 'web',
            assignPublicIp: true,
            minHealthyPercent: 100,
            maxHealthyPercent: 400,
            loadBalancerName: `${projectName}-LB`,
            taskSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            },
            // redirectHTTP: true,
            certificate: Certificate.fromCertificateArn(this, `${projectName}-certificate`, props.certificateArn)
        });

        webService.targetGroup.configureHealthCheck({
            path: "/auth/login",
            healthyThresholdCount: 3,
            healthyHttpCodes: '200',
            interval: Duration.seconds(10),
            timeout: Duration.seconds(5),
        });

        // Allow access to EFS from Fargate ECS
        fileSystem.connections.allowDefaultPortFrom(webService.service.connections);

        const scalableTarget = webService.service.autoScaleTaskCount({
            minCapacity: 1,
            maxCapacity: 5,
        })

        scalableTarget.scaleOnMemoryUtilization(`${projectName}-ScaleUpMem`, {
            targetUtilizationPercent: 60,
        });

        scalableTarget.scaleOnCpuUtilization(`${projectName}-ScaleUpCPU`, {
            targetUtilizationPercent: 60,
        });

        const logReceivingLambdaFunction = new NodejsFunction(this, "LogReceivingLambdaFunction", {
            runtime: aws_lambda.Runtime.NODEJS_20_X,
            entry: path.join(__dirname, `/../lambda/alerter.ts`),
            handler: "handler",
            retryAttempts: 0,
            initialPolicy: [
                new iam.PolicyStatement({
                    actions: ["ssm:GetParameter", "ssm:GetParametersByPath"],
                    resources: ["*"]
                }),
            ],
            timeout: Duration.seconds(30),
        });

        const logGroupLambdaSubscription = new SubscriptionFilter(this, 'LogGroupLambdaSubscription', {
            logGroup: webLogGroup,
            destination: new aws_logs_destinations.LambdaDestination(logReceivingLambdaFunction),
            filterPattern: aws_logs.FilterPattern.anyTerm("ERROR", "CRITICAL", "Exception"),
        });


        const redisSecurityGroup = new ec2.SecurityGroup(
          this,
          `${projectName}-redisCacheSecurityGroup`,
          {
              vpc: props.vpc,
              allowAllOutbound: true,
              description: "Security group for the redis cluster",
          }
        );
        redisSecurityGroup.addIngressRule(
          webService.service.connections.securityGroups[0],
          ec2.Port.allTraffic(),
          "Allow access to redis from the web service"
        );

        // Create a subnet group
        const subnetGroup = new elasticcache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
            description: 'Subnet group for Redis',
            subnetIds: props.vpc.publicSubnets.map((subnet) => subnet.subnetId),
        });

        const redis = new elasticcache.CfnCacheCluster (this, `${projectName}-redis`, {
            engine: "redis" ,
            numCacheNodes: 1,
            cacheNodeType: props.cacheNodeType,
            clusterName: `${projectName}-redis`,
            vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
            cacheSubnetGroupName: subnetGroup.ref,
        });


        // Publish the web service ARN as an output
        new CfnOutput(this, 'EcsWebServiceArn', {
            value: webService.service.serviceArn,
            exportName: 'EcsWebServiceArn'
        });
    }
}
