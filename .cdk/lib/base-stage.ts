import {CfnOutput, Stage, StageProps} from 'aws-cdk-lib';
import {BaseStack} from './base-stack';
import {Construct} from 'constructs';
import {AppStack} from "./app-stack";

export interface baseStageProps extends StageProps {
    projectName: string
    environmentName: string,
    envFileName: string,
    dbMaxAllocatedStorage: number;
    dbAllocatedStorage: number;
    dbInstanceType: string;
    dbName: string;
    certificateArn: string;
    taskCPU: number;
    taskMemory: number;
    cacheNodeType: string;
}

export class BaseStage extends Stage {
    public readonly albAddress: CfnOutput

    constructor(scope: Construct, id: string, props: baseStageProps) {
        super(scope, id, props);

        const baseStack = new BaseStack(this, 'Base', {
            projectName: props.projectName,
            environmentName: props.environmentName,
            dbMaxAllocatedStorage: props.dbMaxAllocatedStorage,
            dbAllocatedStorage: props.dbAllocatedStorage,
            dbInstanceType: props.dbInstanceType,
            dbName: props.dbName
        });

        const appStack = new AppStack(this, 'App', {
            bucket: baseStack.bucket,
            vpc: baseStack.vpc,
            cluster: baseStack.cluster,
            environmentName: props.environmentName,
            projectName: props.projectName,
            certificateArn: props.certificateArn,
            envFileName: props.envFileName,
            taskCPU: props.taskCPU,
            taskMemory: props.taskMemory,
            cacheNodeType: props.cacheNodeType
        });

        // this.albAddress = new CfnOutput(appStack, 'AlbAddress', {
        //     value: `http://${appStack.alb.loadBalancerDnsName}/`
        // });
    }
}