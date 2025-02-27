import * as lambda from '@aws-cdk/aws-lambda';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { CodeTask } from './CodeTask';


export namespace LoopTask {
  export type FunctionProps = Partial<Omit<CodeTask.FunctionProps, 'code'>>;

  export interface Props {
    /**
     * The payload that is used for the `InvokeFunction` task.
     */
    functionPayload?: { [key: string]: unknown };
    /**
     * The props that are passed to the Lambda function.
     */
    functionProps?: FunctionProps;
    /**
     * The amount of seconds the wait step will wait before looping.
     *
     * @default 10
     */
    waitSeconds?: number;
    /**
     * The main execution code.
     */
    executeStepCode: lambda.Code;
    /**
     * The code that will be executed to verify the outcome of the execution step. The code must return an object
     * containing the given `verifyStatusField` field.
     */
    verifyStepCode: lambda.Code;
    /**
     * The path where the verify steps result will be stored.
     *
     * @default $.verify
     */
    verifyPath?: string;
    /**
     * The field that contains the status of the verify step.
     *
     * @default status
     */
    verifyStatusField?: string;
  }
}

/**
 * Class that represents a step function execute, wait and verify loop.
 */
export class LoopTask extends sfn.StateMachineFragment {
  public readonly startState: sfn.State;
  public readonly endStates: sfn.INextable[];
  private readonly deploy: CodeTask;
  private readonly verify: CodeTask;

  constructor(scope: cdk.Construct, id: string, props: LoopTask.Props) {
    super(scope, id);
    const {
      functionPayload,
      functionProps,
      waitSeconds = 10,
      executeStepCode,
      verifyStepCode,
      verifyPath = '$.VerifyResult',
      verifyStatusField = 'Status',
    } = props;

    const statusPath = `${verifyPath}.${verifyStatusField}`;

    this.deploy = new CodeTask(this, `Exec`, {
      resultPath: 'DISCARD',
      functionPayload,
      functionProps: {
        code: executeStepCode,
        ...functionProps,
      },
    });

    this.verify = new CodeTask(this, `Verify`, {
      resultPath: verifyPath,
      functionPayload,
      functionProps: {
        code: verifyStepCode,
        ...functionProps,
      },
    });

    const wait = new sfn.Wait(this, `Wait`, {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(waitSeconds)),
    });

    const pass = new sfn.Pass(this, `Succeeded`);

    const fail = new sfn.Fail(this, `Failed`);

    sfn.Chain.start(this.deploy)
      .next(wait)
      .next(this.verify)
      .next(
        new sfn.Choice(this, `Choice`)
          .when(sfn.Condition.stringEquals(statusPath, 'SUCCEEDED'), pass)
          .when(sfn.Condition.stringEquals(statusPath, 'FAILED'), fail)
          .otherwise(wait)
          .afterwards(),
      );

    // Not sure why but we cannot use chain.startState and chain.endStates here.
    this.startState = this.deploy.startState;
    this.endStates = [pass];
  }

  addCatch(handler: sfn.IChainable, props?: sfn.CatchProps): this {
    this.deploy.addCatch(handler, props);
    this.verify.addCatch(handler, props);
    return this;
  }
}
