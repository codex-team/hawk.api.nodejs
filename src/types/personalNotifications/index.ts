import { AssigneeNotificationTask } from './assignee';
import { PlanProlongationNotificationTask } from './plan-prolongation';
import { PaymentFailedNotificationTask } from './payment-failed';
import { PaymentSuccessNotificationTask } from './payments-success';

export { SenderWorkerTaskType } from './task-type';
export { SenderWorkerPayload, SenderWorkerTask } from './task';
export { AssigneeNotificationTask, AssigneeNotificationPayload } from './assignee';
export { PlanProlongationNotificationTask, PlanProlongationNotificationPayload } from './plan-prolongation';
export { PaymentFailedNotificationTask, PaymentFailedNotificationPayload } from './payment-failed';
export { PaymentSuccessNotificationTask, PaymentSuccessNotificationPayload } from './payments-success';

/**
 * All task payloads
 */
export type SenderWorkerTasks = AssigneeNotificationTask | PlanProlongationNotificationTask | PaymentFailedNotificationTask | PaymentSuccessNotificationTask;
