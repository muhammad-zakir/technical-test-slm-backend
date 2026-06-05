import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            checkDatabaseHealth: jest.fn().mockResolvedValue({
              status: 'ok',
              database: 'connected',
              timestamp: new Date().toISOString(),
            }),
          },
        },
      ],
    }).compile();

    appController = moduleRef.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('returns status ok when database is connected', async () => {
      const result = await appController.getHealth();
      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
    });
  });
});
