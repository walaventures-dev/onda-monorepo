import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class PendingRequestsSseService {
  private streams = new Map<string, Subject<MessageEvent>>();

  private bus(storeId: string): Subject<MessageEvent> {
    let subject = this.streams.get(storeId);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.streams.set(storeId, subject);
    }
    return subject;
  }

  stream(storeId: string) {
    return this.bus(storeId).asObservable();
  }

  emit(storeId: string, data: unknown) {
    this.bus(storeId).next({ data } as MessageEvent);
  }
}
