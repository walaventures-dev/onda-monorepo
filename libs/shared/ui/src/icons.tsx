'use client';

import type { ReactNode } from 'react';
import { CircleIcon as Circle } from '@phosphor-icons/react/dist/csr/Circle';
import { SparkleIcon as Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { UsersThreeIcon as UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { FireIcon as Fire } from '@phosphor-icons/react/dist/csr/Fire';
import { TargetIcon as Target } from '@phosphor-icons/react/dist/csr/Target';
import { WarningIcon as Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { InfoIcon as Info } from '@phosphor-icons/react/dist/csr/Info';
import { CrownIcon as Crown } from '@phosphor-icons/react/dist/csr/Crown';
import { MoonIcon as Moon } from '@phosphor-icons/react/dist/csr/Moon';
import { WhatsappLogoIcon as WhatsappLogo } from '@phosphor-icons/react/dist/csr/WhatsappLogo';
import { CalendarIcon as Calendar } from '@phosphor-icons/react/dist/csr/Calendar';
import { SunIcon as Sun } from '@phosphor-icons/react/dist/csr/Sun';
import { CalendarBlankIcon as CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { PencilSimpleIcon as PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { PercentIcon as Percent } from '@phosphor-icons/react/dist/csr/Percent';
import { CurrencyDollarIcon as CurrencyDollar } from '@phosphor-icons/react/dist/csr/CurrencyDollar';
import { TagIcon as Tag } from '@phosphor-icons/react/dist/csr/Tag';
import { PackageIcon as Package } from '@phosphor-icons/react/dist/csr/Package';
import { DotsThreeIcon as DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree';
import { DownloadSimpleIcon as DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { PlusIcon as Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { CopyIcon as Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { PowerIcon as Power } from '@phosphor-icons/react/dist/csr/Power';
import { TrashIcon as Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { CheckIcon as Check } from '@phosphor-icons/react/dist/csr/Check';
import { LockIcon as Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { GlobeIcon as Globe } from '@phosphor-icons/react/dist/csr/Globe';
import { TicketIcon as Ticket } from '@phosphor-icons/react/dist/csr/Ticket';
import { PlusCircleIcon as PlusCircle } from '@phosphor-icons/react/dist/csr/PlusCircle';
import { GiftIcon as Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { FloppyDiskIcon as FloppyDisk } from '@phosphor-icons/react/dist/csr/FloppyDisk';
import { EyeIcon as Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeSlashIcon as EyeSlash } from '@phosphor-icons/react/dist/csr/EyeSlash';
import { XIcon as X } from '@phosphor-icons/react/dist/csr/X';
import { MapPinIcon as MapPin } from '@phosphor-icons/react/dist/csr/MapPin';
import { TrendUpIcon as TrendUp } from '@phosphor-icons/react/dist/csr/TrendUp';
import { ChartBarIcon as ChartBar } from '@phosphor-icons/react/dist/csr/ChartBar';
import { GearIcon as Gear } from '@phosphor-icons/react/dist/csr/Gear';
import { IdentificationCardIcon as IdentificationCard } from '@phosphor-icons/react/dist/csr/IdentificationCard';
import { SidebarSimpleIcon as SidebarSimple } from '@phosphor-icons/react/dist/csr/SidebarSimple';
import { CaretLeftIcon as CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon as CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { CaretDownIcon as CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { FunnelSimpleIcon as FunnelSimple } from '@phosphor-icons/react/dist/csr/FunnelSimple';
import { SnowflakeIcon as Snowflake } from '@phosphor-icons/react/dist/csr/Snowflake';
import { CreditCardIcon as CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';
import { UserCircleIcon as UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { ShareNetworkIcon as ShareNetwork } from '@phosphor-icons/react/dist/csr/ShareNetwork';
import { SignOutIcon as SignOut } from '@phosphor-icons/react/dist/csr/SignOut';
import { MegaphoneIcon as Megaphone } from '@phosphor-icons/react/dist/csr/Megaphone';
import { CameraIcon as Camera } from '@phosphor-icons/react/dist/csr/Camera';
import { QrCodeIcon as QrCode } from '@phosphor-icons/react/dist/csr/QrCode';
import { ReceiptIcon as Receipt } from '@phosphor-icons/react/dist/csr/Receipt';

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
  eyeOff: <EyeSlash size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  close: <X size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  near: <MapPin size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  upgrade: <TrendUp size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  chart: <ChartBar size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  gear: <Gear size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  pass: <IdentificationCard size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  panelLeft: <SidebarSimple size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  chevronLeft: <CaretLeft size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  chevronRight: <CaretRight size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  chevronDown: <CaretDown size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  filter: <FunnelSimple size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  snowflake: <Snowflake size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  wallet: <CreditCard size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  profile: <UserCircle size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  share: <ShareNetwork size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  logout: <SignOut size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  megaphone: <Megaphone size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  camera: <Camera size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  qr: <QrCode size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  receipt: <Receipt size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  /** Mano de marca — único ícono para «Ondas». Hereda `currentColor`. */
  ondas: (
    <span
      className={`inline-block bg-current ${CLASS}`}
      style={{
        WebkitMaskImage: 'url(/brand/onda-hand.png)',
        maskImage: 'url(/brand/onda-hand.png)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
      aria-hidden
    />
  ),
};

/** Mano inline; hereda el color del texto padre (coherente con chips/filas). */
export function OndaMark({ className = 'h-3 w-3 shrink-0' }: { className?: string }) {
  return (
    <span
      className={`inline-block bg-current ${className}`.trim()}
      style={{
        WebkitMaskImage: 'url(/brand/onda-hand.png)',
        maskImage: 'url(/brand/onda-hand.png)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
      aria-hidden
    />
  );
}

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
