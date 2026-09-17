export const LEAVE_REPOSITORY = Symbol('LEAVE_REPOSITORY');

/**
 * Nama event Observer Pattern — backend-architecture-hr.md §3 & §6: "setelah
 * cuti disetujui -> update saldo & kalender tim". Dipakai untuk decoupling
 * dari modul Attendance (menandai attendance tanggal terkait sebagai
 * ON_LEAVE) tanpa LeaveService bergantung langsung pada AttendanceService.
 */
export const LEAVE_APPROVED_EVENT = 'leave.approved';

/**
 * Dipancarkan saat pengajuan cuti yang SUDAH disetujui dibatalkan, supaya
 * AttendanceService bisa membatalkan tanda ON_LEAVE yang sebelumnya dibuat.
 */
export const LEAVE_CANCELLED_EVENT = 'leave.cancelled';
