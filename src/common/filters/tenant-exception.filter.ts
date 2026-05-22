import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(
        typeof body === 'object' ? body : { statusCode: status, message: body },
      );
      return;
    }

    if (exception instanceof Error) {
      if (exception.message === 'No tenant context found for this request') {
        response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'No tenant context found for this request',
        });
        return;
      }

      // Prisma known/validation errors
      const name = (exception as any).constructor?.name ?? '';
      if (name.startsWith('PrismaClient')) {
        this.logger.error(exception.message, exception.stack);
        const prismaMessage = exception.message
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .at(-1) ?? 'Database error';
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: prismaMessage,
        });
        return;
      }

      this.logger.error(exception.message, exception.stack);
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  }
}
