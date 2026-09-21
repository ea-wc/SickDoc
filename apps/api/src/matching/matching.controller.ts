import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { SuggestDto } from './dto/suggest.dto.js';
import { MatchingService } from './matching.service.js';

@Controller('symptoms')
@Roles(Role.PATIENT)
export class SymptomsController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get()
  list(@Query('q') q?: string) {
    return this.matchingService.listSymptoms(q);
  }
}

@Controller('matching')
@Roles(Role.PATIENT)
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post('suggest')
  @HttpCode(HttpStatus.OK)
  suggest(@Body() dto: SuggestDto) {
    return this.matchingService.suggest(dto);
  }
}
