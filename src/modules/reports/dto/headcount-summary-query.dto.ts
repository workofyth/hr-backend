import { IsUUID } from 'class-validator';

/** DTO query dashboard headcount (roadmap Phase 5: "Dashboard headcount"). */
export class HeadcountSummaryQueryDto {
  @IsUUID()
  companyId: string;
}
