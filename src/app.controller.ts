import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  root(): { name: string; status: string; docs: string; health: string } {
    return {
      name: 'Deltra App API',
      status: 'ok',
      docs: '/api/docs',
      health: '/health',
    };
  }

  @Public()
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
