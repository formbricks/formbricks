#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {BaseStack} from "../lib/base-stack";
import {AppStack} from "../lib/app-stack";
import {CdkPipelineStack} from "../lib/cdk-pipeline-stack";
import {Params} from "../lib/params";

const app = new cdk.App();

// const baseStack = new BaseStack(app, 'OpinodoSurveysBase', {
//     projectName: "opinodo-surveys-db",
//     environmentName: "sandbox",
//     env: {account: '599781234736', region: 'eu-central-1'},
//     dbMaxAllocatedStorage: 512,
//     dbAllocatedStorage: 256,
//     dbInstanceType: 't4g.micro',
//     dbName: 'OpinodoSurveysDB'
// });
//
// new AppStack(app, 'OpinodoSurveysApp', {
//     taskCPU: 256, taskMemory: 512,
//     bucket: baseStack.bucket,
//     cluster: baseStack.cluster,
//     vpc: baseStack.vpc,
//     projectName: "opinodo-surveys-app",
//     environmentName: "sandbox",
//     envFileName: "production.env",
//     cacheNodeType:"cache.t3.micro",
//     certificateArn: "arn:aws:acm:eu-central-1:599781234736:certificate/0f801ab4-cd43-4b53-92c3-79e88b032dc4",
//     env: {account: '599781234736', region: 'eu-central-1'}
// });
new CdkPipelineStack(app, 'OpinodoSurveysPipeline', {
    env: {
        account: Params.TOOLING_ACCOUNT_ID,
        region: Params.AWS_REGION
    }
});
