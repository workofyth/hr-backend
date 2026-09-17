import { IsOptional, IsString } from 'class-validator';

/** DTO keputusan approval (approve/reject) — komentar approver opsional. */
export class LeaveDecisionDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
