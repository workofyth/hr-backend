import { LeaveType } from './leave-type.entity';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveRequest } from './leave-request.entity';
import { LeaveApproval } from './leave-approval.entity';

export { LeaveType, LeaveBalance, LeaveRequest, LeaveApproval };

export const leaveEntities = [LeaveType, LeaveBalance, LeaveRequest, LeaveApproval];
