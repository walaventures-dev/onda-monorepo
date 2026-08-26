'use client';

import {
  PosVenderCore,
  type PosVenderMemberSession,
} from '@onda/shared-ui';
import { useMerchantAuth } from '../lib/MerchantAuth';
import { useEffect, useState } from 'react';
import { api } from '@onda/shared-ui';
import type { PosAttendantDto } from '@onda/shared-types';

export function PosVenderPanel({
  storeId,
  ondaValue,
}: {
  storeId: string;
  ondaValue?: number | null;
}) {
  const { user } = useMerchantAuth();
  const [member, setMember] = useState<PosVenderMemberSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user) {
        setMember(null);
        return;
      }
      try {
        const me = await api<PosAttendantDto>(`/pos/stores/${storeId}/me`);
        if (!cancelled) {
          setMember({
            memberId: me.id,
            name: me.name,
            role: me.role,
          });
        }
      } catch {
        if (!cancelled) setMember(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, user]);

  return (
    <PosVenderCore
      storeId={storeId}
      ondaValue={ondaValue}
      variant="dashboard"
      memberSession={member}
    />
  );
}
