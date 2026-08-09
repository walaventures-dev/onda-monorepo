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
      onSelectionChange={(key) => router.push(key === 'perfil' ? '/perfil' : '/')}
    >
      <Tabs.List className="onda-pwa-tabbar" aria-label="Navegación principal" hidden={!showTabs}>
        <Tabs.Tab
          id="wallet"
          className="onda-pwa-tab"
          onPress={() => {
            if (pathname !== '/') router.push('/');
          }}
        >
          {OndaIcons.wallet}
          <span>Mis tarjetas</span>
        </Tabs.Tab>
        <Tabs.Tab id="perfil" className="onda-pwa-tab">
          {OndaIcons.profile}
          <span>Perfil</span>
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id={selectedKey} className={showTabs ? 'onda-pwa-tabbed-content' : undefined}>
        {children}
      </Tabs.Panel>
    </Tabs>
  );
}
