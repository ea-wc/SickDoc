import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { DomainEvent } from './domain-events.types.js';

/**
 * Minimal in-process event bus. Domain services emit; the notifications module
 * subscribes and persists rows. Single-instance by design (see the "Known
 * limitations" note in ARCHITECTURE.md).
 */
@Injectable()
export class DomainEventsService {
  private readonly emitter = new EventEmitter();

  emit(event: DomainEvent): void {
    this.emitter.emit('event', event);
  }

  subscribe(handler: (event: DomainEvent) => void): void {
    this.emitter.on('event', handler);
  }
}
