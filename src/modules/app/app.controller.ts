import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuardConfig } from '../auth/decorator/auth.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @AuthGuardConfig({ isPublic: true })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
