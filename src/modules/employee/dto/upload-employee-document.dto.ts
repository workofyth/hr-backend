import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO field non-file pada `POST /employees/:id/documents` (multipart/
 * form-data — file-nya sendiri lewat `@UploadedFile()`, bukan DTO ini).
 */
export class UploadEmployeeDocumentDto {
  @IsString()
  @IsNotEmpty({ message: 'type wajib diisi, mis. KTP, KONTRAK, IJAZAH' })
  type: string;
}
