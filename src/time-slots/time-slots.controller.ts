import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TimeSlotsService } from './time-slots.service';
import { CreateTimeSlotDto } from './dto/create-time-slot.dto';
import { UpdateTimeSlotDto } from './dto/update-time-slot.dto';

@ApiTags('Time Slots')
@ApiBearerAuth()
@Controller('time-slots')
export class TimeSlotsController {
  constructor(private readonly service: TimeSlotsService) {}

  @Get()
  @ApiOperation({ summary: 'List all time slots ordered by sort order' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by label' })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('page',  new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) { return this.service.findAll({ search, page, limit }); }

  @Get(':id')
  @ApiOperation({ summary: 'Get a time slot by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Create a time slot' })
  create(@Body() dto: CreateTimeSlotDto) { return this.service.create(dto); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a time slot' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTimeSlotDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a time slot' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
