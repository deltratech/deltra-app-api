import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API status metadata', () => {
      expect(appController.root()).toEqual({
        name: 'Deltra App API',
        status: 'ok',
        docs: '/api/docs',
        health: '/health',
      });
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      expect(appController.health()).toEqual({ status: 'ok' });
    });
  });
});
