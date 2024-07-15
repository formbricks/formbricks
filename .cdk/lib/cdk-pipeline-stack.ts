import {SecretValue, Stack, StackProps} from 'aws-cdk-lib';
import {CodePipeline, CodePipelineSource, ManualApprovalStep, ShellStep} from 'aws-cdk-lib/pipelines';
import {Construct} from 'constructs';
import {Params} from './params';
import {BaseStage} from "./base-stage";
import {BuildEnvironmentVariableType, BuildSpec, ComputeType, LinuxArmBuildImage} from "aws-cdk-lib/aws-codebuild";
import {PolicyStatement} from "aws-cdk-lib/aws-iam";

export class CdkPipelineStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const pipeline = new CodePipeline(this, 'Pipeline', {
            crossAccountKeys: true,
            synth: new ShellStep('Synth', {
                primaryOutputDirectory: './.cdk/cdk.out',
                input: CodePipelineSource.gitHub(Params.GITHUB_REPO, Params.BRANCH_NAME, {
                    authentication: SecretValue.secretsManager(Params.GITHUB_TOKEN)
                }),
                commands: ['cd .cdk', 'npm ci', 'npx cdk synth'],
            }),
            assetPublishingCodeBuildDefaults: {
                partialBuildSpec: BuildSpec.fromObject({
                    'phases': {
                        'install': {
                            'commands': [
                                'echo Logging in to Docker...',
                                'docker login --username $DOCKERHUB_USERNAME --password $DOCKERHUB_PASSWORD'
                            ]
                        }
                    }
                }),
                rolePolicy: [
                    PolicyStatement.fromJson({
                        "Effect": "Allow",
                        "Action": [
                            "kms:Decrypt",
                            "kms:DescribeKey",
                            "kms:Encrypt",
                            "kms:GenerateDataKey*",
                            "kms:ReEncrypt*"
                        ],
                        "Resource": "arn:aws:kms:eu-central-1:627299429402:key/0eb3ea93-b6cd-4ee5-9a2a-2bbe30f39ca5"
                    }),
                ],
                buildEnvironment: {
                    environmentVariables: {
                        "DOCKERHUB_USERNAME": {
                            type: BuildEnvironmentVariableType.SECRETS_MANAGER,
                            value: "opinodo/DockerHubCredentials:username",
                        },
                        "DOCKERHUB_PASSWORD": {
                            type: BuildEnvironmentVariableType.SECRETS_MANAGER,
                            value: "opinodo/DockerHubCredentials:password",
                        },
                        "NODE_OPTIONS": {
                            type: BuildEnvironmentVariableType.PLAINTEXT,
                            value: "--max_old_space_size=16384"
                        },
                    },
                    buildImage:  LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
                    computeType: ComputeType.LARGE
                }
            }
        });

        const stagingStage = new BaseStage(this, Params.PROJECT_NAME + '-Staging', {
            projectName: Params.PROJECT_NAME,
            environmentName: 'staging',
            envFileName: 'staging.env',
            dbName: 'DigiopinionSurveysDB',
            dbInstanceType: 't4g.micro',
            dbAllocatedStorage: 50,
            dbMaxAllocatedStorage: 512,
            taskMemory: 512,
            taskCPU: 256,
            certificateArn: Params.STAGING_CERTIFICATE_ARN,
            cacheNodeType: "cache.t3.micro",
            env: {
                account: Params.STAGING_ACCOUNT_ID,
                region: Params.AWS_REGION
            }
        });

        const prodStage = new BaseStage(this, Params.PROJECT_NAME + `-Prod`, {
            projectName: Params.PROJECT_NAME,
            environmentName: 'production',
            envFileName: 'production.env',
            dbName: 'DigiopinionSurveysDB',
            dbInstanceType: 't4g.medium',
            taskMemory: 8192,
            taskCPU: 4096,
            dbAllocatedStorage: 200,
            dbMaxAllocatedStorage: 1024,
            cacheNodeType: "cache.t3.micro",
            certificateArn: Params.PROD_CERTIFICATE_ARN,
            env: {
                account: Params.PROD_ACCOUNT_ID,
                region: Params.AWS_REGION
            }
        });

        const pipelineStagingStage = pipeline.addStage(stagingStage);

        // pipelineStagingStage.addPost(new ShellStep("albTest", {
        //   envFromCfnOutputs: {albAddress: stagingStage.albAddress},
        //   commands: ['curl -f -s -o /dev/null -w "%{http_code}" $albAddress']
        // }));

        const pipelineProdStage = pipeline.addStage(prodStage);

        pipelineProdStage.addPre(new ManualApprovalStep('ManualApproval', {}));
    }
}
