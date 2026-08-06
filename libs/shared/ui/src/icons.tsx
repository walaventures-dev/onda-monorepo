'use client';

import type { ReactNode } from 'react';
import Circle from '@phosphor-icons/react/dist/csr/Circle';
import Sparkle from '@phosphor-icons/react/dist/csr/Sparkle';
import UsersThree from '@phosphor-icons/react/dist/csr/UsersThree';
import Fire from '@phosphor-icons/react/dist/csr/Fire';
import Target from '@phosphor-icons/react/dist/csr/Target';
import Warning from '@phosphor-icons/react/dist/csr/Warning';
import Info from '@phosphor-icons/react/dist/csr/Info';
import Crown from '@phosphor-icons/react/dist/csr/Crown';
import Moon from '@phosphor-icons/react/dist/csr/Moon';
import WhatsappLogo from '@phosphor-icons/react/dist/csr/WhatsappLogo';
import Calendar from '@phosphor-icons/react/dist/csr/Calendar';
import Sun from '@phosphor-icons/react/dist/csr/Sun';
import CalendarBlank from '@phosphor-icons/react/dist/csr/CalendarBlank';
import PencilSimple from '@phosphor-icons/react/dist/csr/PencilSimple';
import Percent from '@phosphor-icons/react/dist/csr/Percent';
import CurrencyDollar from '@phosphor-icons/react/dist/csr/CurrencyDollar';
import Tag from '@phosphor-icons/react/dist/csr/Tag';
import Package from '@phosphor-icons/react/dist/csr/Package';
import DotsThree from '@phosphor-icons/react/dist/csr/DotsThree';
import DownloadSimple from '@phosphor-icons/react/dist/csr/DownloadSimple';
import Plus from '@phosphor-icons/react/dist/csr/Plus';
import Copy from '@phosphor-icons/react/dist/csr/Copy';
import Power from '@phosphor-icons/react/dist/csr/Power';
import Trash from '@phosphor-icons/react/dist/csr/Trash';
import Check from '@phosphor-icons/react/dist/csr/Check';
import Lock from '@phosphor-icons/react/dist/csr/Lock';
import Globe from '@phosphor-icons/react/dist/csr/Globe';
import Ticket from '@phosphor-icons/react/dist/csr/Ticket';
import PlusCircle from '@phosphor-icons/react/dist/csr/PlusCircle';
import Gift from '@phosphor-icons/react/dist/csr/Gift';
import FloppyDisk from '@phosphor-icons/react/dist/csr/FloppyDisk';
import Eye from '@phosphor-icons/react/dist/csr/Eye';
import X from '@phosphor-icons/react/dist/csr/X';
import MapPin from '@phosphor-icons/react/dist/csr/MapPin';
import TrendUp from '@phosphor-icons/react/dist/csr/TrendUp';
import ChartBar from '@phosphor-icons/react/dist/csr/ChartBar';
import Waveform from '@phosphor-icons/react/dist/csr/Waveform';
import Gear from '@phosphor-icons/react/dist/csr/Gear';
import IdentificationCard from '@phosphor-icons/react/dist/csr/IdentificationCard';
import SidebarSimple from '@phosphor-icons/react/dist/csr/SidebarSimple';
import CaretLeft from '@phosphor-icons/react/dist/csr/CaretLeft';
import CaretRight from '@phosphor-icons/react/dist/csr/CaretRight';
import Snowflake from '@phosphor-icons/react/dist/csr/Snowflake';

const SIZE = 16;
const CLASS = 'h-3 w-3 shrink-0';
const CLASS_LG = 'h-4 w-4 shrink-0';

export const OndaIcons = {
  all: <Circle size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  sparkle: <Sparkle size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  users: <UsersThree size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  flame: <Fire size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  target: <Target size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  alert: <Warning size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  info: <Info size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  crown: <Crown size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  moon: <Moon size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  whatsapp: <WhatsappLogo size={SIZE} weight="regular" className={CLASS_LG} aria-hidden="true" />,
  calendar: <Calendar size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  day: <Sun size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  week: <CalendarBlank size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  edit: <PencilSimple size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  percent: <Percent size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  dollar: <CurrencyDollar size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  nXm: <Tag size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  product: <Package size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  other: <DotsThree size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  download: <DownloadSimple size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  plus: <Plus size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  copy: <Copy size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  power: <Power size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  trash: <Trash size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  check: <Check size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  lock: <Lock size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  globe: <Globe size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  ticket: <Ticket size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  accumulate: <PlusCircle size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  redeem: <Gift size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  save: <FloppyDisk size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  eye: <Eye size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  close: <X size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  near: <MapPin size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  upgrade: <TrendUp size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  chart: <ChartBar size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  activity: <Waveform size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  gear: <Gear size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  pass: <IdentificationCard size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  panelLeft: <SidebarSimple size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  chevronLeft: <CaretLeft size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  chevronRight: <CaretRight size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  snowflake: <Snowflake size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
};

export function badgeIcon(badge?: string | null): ReactNode {
  switch (badge) {
    case 'Nuevo':
      return OndaIcons.sparkle;
    case 'Cerca':
      return OndaIcons.target;
    case 'En riesgo':
      return OndaIcons.alert;
    case 'Dormido':
      return OndaIcons.moon;
    case 'VIP':
      return OndaIcons.crown;
    case 'Top':
      return OndaIcons.sparkle;
    case 'Fría':
      return OndaIcons.snowflake;
    default:
      return OndaIcons.users;
  }
}

export function badgeDescription(badge?: string | null): string {
  switch (badge) {
    case 'Nuevo':
      return 'Se unió al programa en este periodo';
    case 'Cerca':
      return 'Le faltan pocas ondas para canjear una promoción';
    case 'En riesgo':
      return 'No visita hace un tiempo y podría dejar de venir';
    case 'Dormido':
      return 'No ha vuelto hace mucho tiempo';
    case 'VIP':
      return 'Está entre los clientes con más ondas acumuladas';
    case 'Top':
      return 'Es de las promociones con mejor desempeño';
    case 'Fría':
      return 'Es de las promociones con menos actividad';
    default:
      return '';
  }
}

export function BadgePill({
  badge,
  className = 'rounded-full bg-[var(--onda-violet-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--onda-violet)]',
}: {
  badge: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={badgeDescription(badge)}
    >
      {badgeIcon(badge)}
      {badge}
    </span>
  );
}
