import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, seconds } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateAttendanceCorrectionDto } from './dto/create-attendance-correction.dto';
import { FindAttendanceHistoryQueryDto } from './dto/find-attendance-history-query.dto';

/**
 * Batas check-in/out lebih ketat dari limit global (roadmap Phase 6
 * "Keamanan") — mencegah spam/DoS ke endpoint yang menghitung ulang
 * geofence & menulis DB tiap kali dipanggil. 10/menit cukup longgar untuk
 * retry sungguhan akibat GPS/koneksi buruk, bukan tarif bisnis (§5.5).
 */
const ATTENDANCE_MARK_THROTTLE = { default: { limit: 10, ttl: seconds(60) } };

/**
 * Hanya menerima request, validasi lewat DTO, dan memanggil AttendanceService
 * — tidak ada logika bisnis di sini (checklist §7 backend-architecture-hr.md).
 * Endpoint absen (check-in/out, history, correction-request) bersifat
 * self-service: aksi selalu atas nama user yang sedang login (§6), bukan
 * target dari path/body — mencegah karyawan absen atas nama orang lain.
 */
@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Throttle(ATTENDANCE_MARK_THROTTLE)
  @Post('check-in')
  checkIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckInDto) {
    return this.attendanceService.checkIn(user.userId, dto);
  }

  @Throttle(ATTENDANCE_MARK_THROTTLE)
  @Post('check-out')
  checkOut(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckOutDto) {
    return this.attendanceService.checkOut(user.userId, dto);
  }

  @Get('history')
  async history(@CurrentUser() user: AuthenticatedUser, @Query() query: FindAttendanceHistoryQueryDto) {
    const result = await this.attendanceService.findHistory(user.userId, query);
    return {
      data: result.items,
      meta: {
        page: result.page,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    };
  }

  @Post('correction-request')
  requestCorrection(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAttendanceCorrectionDto) {
    return this.attendanceService.requestCorrection(user.userId, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.MANAGER)
  @Put('corrections/:id/approve')
  approveCorrection(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attendanceService.approveCorrection(user, id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.MANAGER)
  @Put('corrections/:id/reject')
  rejectCorrection(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attendanceService.rejectCorrection(user, id);
  }
}
