import { Attendance } from './attendance.entity';
import { AttendanceCorrection } from './attendance-correction.entity';
import { OvertimeRequest } from './overtime-request.entity';

export { Attendance, AttendanceCorrection, OvertimeRequest };

export const attendanceEntities = [Attendance, AttendanceCorrection, OvertimeRequest];
