import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { LeaveDecisionDto } from './dto/leave-decision.dto';
import { FindLeaveBalanceQueryDto } from './dto/find-leave-balance-query.dto';
import { FindLeaveRequestsQueryDto } from './dto/find-leave-requests-query.dto';

/**
 * Hanya menerima request, validasi lewat DTO, dan memanggil LeaveService —
 * tidak ada logika bisnis di sini (checklist §7). Path endpoint mengikuti
 * "API Kunci" roadmap-aplikasi-hr.md Phase 3 persis (`/leave-types`,
 * `/leave-balance`, `/leave-requests`), bukan dinaungi prefix `/leave`.
 * Pengajuan/riwayat/pembatalan bersifat self-service (atas nama user yang
 * login); approve/reject untuk atasan (MANAGER) & HR/Super Admin.
 */
@ApiTags('leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('leave-types')
  findLeaveTypes() {
    return this.leaveService.findLeaveTypes();
  }

  @Get('leave-balance')
  findMyBalance(@CurrentUser() user: AuthenticatedUser, @Query() query: FindLeaveBalanceQueryDto) {
    return this.leaveService.findMyBalance(user.userId, query.year);
  }

  @Post('leave-requests')
  apply(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeaveRequestDto) {
    return this.leaveService.apply(user.userId, dto);
  }

  @Get('leave-requests')
  async findMyRequests(@CurrentUser() user: AuthenticatedUser, @Query() query: FindLeaveRequestsQueryDto) {
    const result = await this.leaveService.findMyRequests(user.userId, query);
    return {
      data: result.items,
      meta: {
        page: result.page,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    };
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.MANAGER)
  @Get('leave-approvals/pending')
  findPendingApprovals(@CurrentUser() user: AuthenticatedUser) {
    return this.leaveService.findPendingApprovals(user);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.MANAGER)
  @Put('leave-requests/:id/approve')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.leaveService.approve(user, id, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.MANAGER)
  @Put('leave-requests/:id/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.leaveService.reject(user, id, dto);
  }

  @Put('leave-requests/:id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.leaveService.cancel(user.userId, id);
  }
}
