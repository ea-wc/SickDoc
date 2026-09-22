import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './common/decorators/public.decorator.js';

/* c8 ignore start -- NestJS @Controller decorator expands to a compiler-generated ternary that cannot be exercised from this call site. */
@Controller()
/* c8 ignore stop */
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }
}
