import {
  BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PpdbService } from './ppdb.service';
import { PublicSubmitDto } from './dto/ppdb.dto';

/**
 * No-auth public PPDB endpoints. The tenant is resolved from the `x-tenant-slug`
 * header (sent by the public pages, derived from the share/tracking link's path).
 */
@ApiTags('Public — PPDB')
@Controller('public/ppdb')
export class PublicPpdbController {
  constructor(private readonly ppdb: PpdbService) {}

  // ── Parent tracking portal (by application publicToken) ──────────────────────
  @Public()
  @Get('status/:token')
  @ApiOperation({ summary: 'Parent tracking view for an application' })
  getStatus(@Param('token') token: string) {
    return this.ppdb.getStatus(token);
  }

  @Public()
  @Post('status/:token/documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentType: { type: 'string' },
        requirementKey: { type: 'string' },
        label: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Parent uploads a required document' })
  uploadProof(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType?: string,
    @Body('requirementKey') requirementKey?: string,
    @Body('label') label?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('File must be under 10 MB');
    return this.ppdb.uploadProof(token, file, { documentType: documentType as any, requirementKey, label });
  }

  @Public()
  @Post('status/:token/select-package')
  @ApiOperation({ summary: 'Parent selects a development-fee package' })
  selectPackage(@Param('token') token: string, @Body() body: { devFeeTierId: string }) {
    if (!body?.devFeeTierId) throw new BadRequestException('devFeeTierId is required');
    return this.ppdb.selectPackage(token, body.devFeeTierId);
  }

  @Public()
  @Post('status/:token/claim-payment/:invoiceId')
  @ApiOperation({ summary: 'Parent reports an invoice as paid (admin confirms)' })
  claimPayment(@Param('token') token: string, @Param('invoiceId') invoiceId: string) {
    return this.ppdb.claimPayment(token, invoiceId);
  }

  @Public()
  @Post('lookup')
  @ApiOperation({ summary: 'Find an application tracking link from its number + access code' })
  lookup(@Body() body: { applicationNo: string; code: string }) {
    return this.ppdb.lookup(body?.applicationNo, body?.code);
  }

  // ── Public registration form ─────────────────────────────────────────────
  @Public()
  @Get(':token')
  @ApiOperation({ summary: 'Resolve a public PPDB form by its share token' })
  getForm(@Param('token') token: string) {
    return this.ppdb.getPublicByToken(token);
  }

  @Public()
  @Post(':token')
  @ApiOperation({ summary: 'Submit a public PPDB application' })
  submit(@Param('token') token: string, @Body() dto: PublicSubmitDto) {
    return this.ppdb.submitPublic(token, dto);
  }
}
