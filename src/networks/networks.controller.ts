import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NetworksService } from './networks.service';
import { CreateFoundationPolicyDto } from './dto/create-foundation-policy.dto';
import { UpdateFoundationPolicyDto } from './dto/update-foundation-policy.dto';

@ApiTags('Networks/Foundation Admin')
@ApiBearerAuth()
@Controller('networks')
export class NetworksController {
  constructor(private readonly networksService: NetworksService) {}

  @Get('me/schools')
  @ApiOperation({ summary: 'List schools under the authenticated foundation admin network' })
  listSchools(@CurrentUser() user: any) {
    return this.networksService.listSchools(user);
  }

  @Get('me/schools/:schoolId')
  @ApiOperation({ summary: 'View a school detail within the authenticated foundation admin network' })
  getSchool(@CurrentUser() user: any, @Param('schoolId', ParseUUIDPipe) schoolId: string) {
    return this.networksService.getSchool(user, schoolId);
  }

  @Get('me/dashboard')
  @ApiOperation({ summary: 'Cross-school dashboard rollup for the authenticated foundation admin network' })
  dashboard(@CurrentUser() user: any) {
    return this.networksService.dashboard(user);
  }

  @Get('me/policies')
  @ApiOperation({ summary: 'List centralized foundation policy/template records' })
  @ApiQuery({ name: 'category', required: false })
  listPolicies(@CurrentUser() user: any, @Query('category') category?: string) {
    return this.networksService.listPolicies(user, category);
  }

  @Post('me/policies')
  @ApiOperation({ summary: 'Create a centralized foundation policy/template record' })
  createPolicy(@CurrentUser() user: any, @Body() dto: CreateFoundationPolicyDto) {
    return this.networksService.createPolicy(user, dto);
  }

  @Patch('me/policies/:id')
  @ApiOperation({ summary: 'Update a centralized foundation policy/template record' })
  updatePolicy(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFoundationPolicyDto,
  ) {
    return this.networksService.updatePolicy(user, id, dto);
  }

  @Delete('me/policies/:id')
  @ApiOperation({ summary: 'Soft-delete a centralized foundation policy/template record' })
  deletePolicy(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.networksService.deletePolicy(user, id);
  }

  @Get('me/audit-logs')
  @ApiOperation({ summary: 'List recent foundation admin audit logs' })
  auditLogs(@CurrentUser() user: any) {
    return this.networksService.auditLogs(user);
  }
}
