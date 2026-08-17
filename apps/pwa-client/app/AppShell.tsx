'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, OndaIcons } from '@onda/shared-ui';
import { useSession } from '../lib/session';

type TabKey = 'wallet' | 'perfil';

function tabKeyForPath(pathname: string): TabKey {
  return pathname === '/perfil' ? 'perfil' : 'wallet';
}

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const showTabs = Boolean(session && session.user.name.trim().length > 0);
  const selectedKey = tabKeyForPath(pathname);

  return (
    <Tabs
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        if (key === 'perfil') {
          if (pathname !== '/perfil') router.push('/perfil');
          return;
        }
        if (pathname === '/' || pathname.startsWith('/r/')) return;
        router.push('/');
      }}
    >
      <Tabs.List className="onda-pwa-tabbar" aria-label="Navegación principal" hidden={!showTabs}>
        <Tabs.Tab
          id="wallet"
          className="onda-pwa-tab"
          onPress={() => {
            if (pathname !== '/') router.push('/');
          }}
        >
          <span className="onda-pwa-tab-icon">{OndaIcons.wallet}</span>
          <span className="onda-pwa-tab-label">Tarjetas</span>
        </Tabs.Tab>
        <Tabs.Tab id="perfil" className="onda-pwa-tab">
          <span className="onda-pwa-tab-icon">{OndaIcons.profile}</span>
          <span className="onda-pwa-tab-label">Perfil</span>
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id={selectedKey} className={showTabs ? 'onda-pwa-tabbed-content' : undefined}>
        {children}
      </Tabs.Panel>
    </Tabs>
  );
}
