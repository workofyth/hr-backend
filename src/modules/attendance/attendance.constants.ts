export const ATTENDANCE_REPOSITORY = Symbol('ATTENDANCE_REPOSITORY');
export const ATTENDANCE_CORRECTION_REPOSITORY = Symbol('ATTENDANCE_CORRECTION_REPOSITORY');

/**
 * Nama event Observer Pattern — backend-architecture-hr.md §3 & §6:
 * "AttendanceRepository.save() -> EventEmitter('attendance.checked_in')
 * -> NotificationService (async)".
 */
export const ATTENDANCE_CHECKED_IN_EVENT = 'attendance.checked_in';
