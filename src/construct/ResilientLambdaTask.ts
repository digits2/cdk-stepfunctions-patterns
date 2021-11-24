import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as cdk from '@aws-cdk/core';

/**
 * Define a Lambda Invoke task with transient errors handling implemented.
 */
export class ResilientLambdaTask extends tasks.LambdaInvoke {

  public static readonly TransientErrors: string[] = [
    // Added by default in CDK
    // "Lambda.ServiceException",
    // "Lambda.AWSLambdaException",
    // "Lambda.SdkClientException",
    // Additional Retry condition not covered by default CDK conditions
    "Lambda.TooManyRequestsException"
  ]

  constructor(scope: cdk.Construct, id: string, props: tasks.LambdaInvokeProps) {
    super(scope, id, props)
    ResilientLambdaTask.addDefaultRetry(this);
  }

  /**
   * Adds retry for transient Lambda errors.
   * @param task Lambda tast to modify.
   */
  public static addDefaultRetry(task: tasks.LambdaInvoke): void {
    // https://docs.aws.amazon.com/step-functions/latest/dg/bp-lambda-serviceexception.html
    task.addRetry({
      errors: ResilientLambdaTask.TransientErrors,
      backoffRate: 2,
      maxAttempts: 6,
      interval: cdk.Duration.seconds(2)
    });
  }
}