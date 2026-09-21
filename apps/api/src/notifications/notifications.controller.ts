import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { NotificationsQueryDto } from './dto/notifications-query.dto.js';
import { NotificationsService } from './notifications.service.js';

/** Caller's notification feed (docs/API_SPEC.md §11). */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: NotificationsQueryDto) {
    return this.notificationsService.list(user.id, query);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.notificationsService.markRead(user.id, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }
}
