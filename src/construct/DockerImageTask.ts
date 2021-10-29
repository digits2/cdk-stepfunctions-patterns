import * as lambda from '@aws-cdk/aws-lambda';
import { DockerImageFunction, DockerImageFunctionProps } from '@aws-cdk/aws-lambda';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as cdk from '@aws-cdk/core';
import { ResilientLambdaTask } from './ResilientLambdaTask';

export namespace DockerImageTask {
  /**
   *  Based on `lambda.FunctionProps` where
   *   * `code` is required;
   *   * `handler`, `runtime` are excluded;
   *   * other properties are optional.
   */
  export type FunctionProps = Partial<lambda.FunctionProps> &
    Partial<Omit<lambda.DockerImageFunctionProps, 'code'>> &
    Partial<Omit<lambda.DockerImageFunctionProps, 'runtime'>> &
    Partial<Omit<lambda.DockerImageFunctionProps, 'memorySize'>>;

  export interface Props extends sfn.TaskStateBaseProps {
    /**
     * The payload that is used for the `InvokeFunction` task.
     */
    functionPayload?: { [key: string]: unknown };
    /**
     * The props that are passed to the Lambda function.
     */
    functionProps: DockerImageFunctionProps;
    /**
     * the lambda code
    */
    // code: lambda.DockerImageCode;
  }
}

/**
 * Class that represents a step function invoke function task.
 */
export class DockerImageTask extends sfn.StateMachineFragment {
  public readonly startState: tasks.LambdaInvoke;
  public readonly endStates: sfn.INextable[];

  public readonly lambdaFunction: DockerImageFunction;

  constructor(scope: cdk.Construct, id: string, props: DockerImageTask.Props) {
    super(scope, id);

    const func = new lambda.DockerImageFunction(this, 'Handler', {
      timeout: props.functionProps.timeout ? props.functionProps.timeout : cdk.Duration.minutes(15),
      memorySize: props.functionProps.memorySize ? props.functionProps.memorySize : 512,
      ...props.functionProps,
    });

    this.lambdaFunction = func;

    const funcAlias = new lambda.Alias(this, 'LambdaAlias', {
      aliasName: 'live',
      version: func.currentVersion,
    });

    const task = new ResilientLambdaTask(this, id, {
      lambdaFunction: funcAlias,
      payload: sfn.TaskInput.fromObject(props.functionPayload!),
      payloadResponseOnly: true,
      ...props,
    });

    task.addRetry({
      errors: ['ServiceUnavailableException'],
    });
    this.startState = task;
    this.endStates = [task];
  }

  addCatch(handler: sfn.IChainable, props?: sfn.CatchProps): this {
    this.startState.addCatch(handler, props);
    return this;
  }
}
