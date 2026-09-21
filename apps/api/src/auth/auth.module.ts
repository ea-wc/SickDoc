import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MeController } from './me.controller.js';
import { TokenService } from './token.service.js';

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, TokenService],
})
export class AuthModule {}
