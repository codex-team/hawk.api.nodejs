/**
 * Types of tasks for sender worker
 */
export enum SenderWorkerTaskType {
  /**
   * Task to notify the user about the assignment to the task
   */
  Assignee = 'assignee',

  /**
   * Task to notify the user about workspace plan prolongation
   */
  PlanProlongation = 'plan-prolongation',

  /**
   * Task when user payment failed
   */
  PaymentFailed = 'payment-failed',

  /**
   * Task on successful user payment
   */
  PaymentSuccess = 'payment-success',

  /**
   * Task for user registration
   */
  SignUp = 'sign-up',

  /**
   * Task for password recovering
   */
  PasswordReset = 'password-reset',

  /**
   * Task for sending an invitation to the user to join the workspace
   */
  WorkspaceInvite = 'workspace-invite',
}
