import { AssigneeNotificationTask } from './assignee';
import { PlanProlongationNotificationTask } from './plan-prolongation';
import { PaymentFailedNotificationTask } from './payment-failed';
import { PaymentSuccessNotificationTask } from './payments-success';
import { SignUpNotificationTask } from './sign-up';

export { SenderWorkerTaskType } from './task-type';
export { SenderWorkerPayload, SenderWorkerTask } from './task';
export { AssigneeNotificationTask, AssigneeNotificationPayload } from './assignee';
export { PlanProlongationNotificationTask, PlanProlongationNotificationPayload } from './plan-prolongation';
export { PaymentFailedNotificationTask, PaymentFailedNotificationPayload } from './payment-failed';
export { PaymentSuccessNotificationTask, PaymentSuccessNotificationPayload } from './payments-success';
export { SignUpNotificationTask, SignUpNotificationPayload } from './sign-up';

/**
 * All task payloads
 */
export type SenderWorkerTasks = AssigneeNotificationTask | PlanProlongationNotificationTask | PaymentFailedNotificationTask | PaymentSuccessNotificationTask | SignUpNotificationTask;
