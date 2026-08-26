'use client';

import { useEffect, useState } from 'react';
import { Button, api } from '@onda/shared-ui';
import type { StoreMemberDto, TeamQuotaDto } from '@onda/shared-types';

export function TeamMembersPanel({ storeId }: { storeId: string }) {
  const [members, setMembers] = useState<StoreMemberDto[]>([]);
  const [quota, setQuota] = useState<TeamQuotaDto | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const res = await api<{ members: StoreMemberDto[]; quota: TeamQuotaDto }>(
      `/stores/${storeId}/members`
    );
    setMembers(res.members);
    setQuota(res.quota);
  }

  useEffect(() => {
    if (storeId) void load();
  }, [storeId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api(`/stores/${storeId}/members`, {
        method: 'POST',
        body: JSON.stringify({ name, email, role: 'CAJA' }),
      });
      setName('');
      setEmail('');
      setMsg('Invitación enviada');
      await load();
    } catch (err: any) {
      setMsg(err?.message || 'No se pudo invitar');
    }
  }

  return (
    <div className="space-y-6">
      {quota ? (
        <p className="text-sm text-[var(--onda-muted)]">
          Cajas: {quota.cajaUsed}/{quota.cajaMax} · Admin: {quota.adminUsed}/{quota.adminMax}
        </p>
      ) : null}
      <form onSubmit={invite} className="onda-card grid gap-3 p-4 sm:grid-cols-3">
        <label className="block space-y-1 text-sm">
          <span className="text-[var(--onda-muted)]">Nombre</span>
          <input
            className="onda-input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-[var(--onda-muted)]">Correo</span>
          <input
            className="onda-input w-full"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <div className="flex items-end">
          <Button type="submit">Invitar caja</Button>
        </div>
      </form>
      {msg ? <p className="text-sm text-[var(--onda-muted)]">{msg}</p> : null}
      <ul className="onda-card divide-y divide-[var(--onda-border)]">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{m.name}</p>
              <p className="text-[var(--onda-muted)]">
                {m.email} · {m.role} · {m.status}
              </p>
            </div>
            {m.role === 'CAJA' && m.status !== 'REVOKED' ? (
              <div className="flex gap-2">
                {m.status === 'PENDING' ? (
                  <button
                    type="button"
                    className="text-xs text-[var(--onda-primary)]"
                    onClick={() =>
                      void api(`/stores/${storeId}/members/${m.id}/resend`, { method: 'POST' })
                    }
                  >
                    Reenviar
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-xs text-[var(--onda-danger)]"
                  onClick={() =>
                    void api(`/stores/${storeId}/members/${m.id}/revoke`, {
                      method: 'POST',
                    }).then(load)
                  }
                >
                  Revocar
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
