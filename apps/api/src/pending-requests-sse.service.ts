import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

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

  stream(storeId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const busSub = this.bus(storeId).subscribe(subscriber);
      const ping = setInterval(() => {
        subscriber.next({ data: { kind: 'ping' } } as MessageEvent);
      }, 25000);
      return () => {
        clearInterval(ping);
        busSub.unsubscribe();
      };
    });
  }

  emit(storeId: string, data: unknown) {
    this.bus(storeId).next({ data } as MessageEvent);
  }
}
