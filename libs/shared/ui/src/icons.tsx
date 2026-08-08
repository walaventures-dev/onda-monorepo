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
import { XIcon as X } from '@phosphor-icons/react/dist/csr/X';
import { MapPinIcon as MapPin } from '@phosphor-icons/react/dist/csr/MapPin';
import { TrendUpIcon as TrendUp } from '@phosphor-icons/react/dist/csr/TrendUp';
import { ChartBarIcon as ChartBar } from '@phosphor-icons/react/dist/csr/ChartBar';
import { WaveformIcon as Waveform } from '@phosphor-icons/react/dist/csr/Waveform';
import { GearIcon as Gear } from '@phosphor-icons/react/dist/csr/Gear';
import { IdentificationCardIcon as IdentificationCard } from '@phosphor-icons/react/dist/csr/IdentificationCard';
import { SidebarSimpleIcon as SidebarSimple } from '@phosphor-icons/react/dist/csr/SidebarSimple';
import { CaretLeftIcon as CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon as CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { SnowflakeIcon as Snowflake } from '@phosphor-icons/react/dist/csr/Snowflake';

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

export function OndaMark({ className = 'h-3 w-3 shrink-0' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M192.982 189.728C198.665 189.338 204.377 189.464 210.038 190.106C231.759 192.615 248.789 200.395 263.146 217.316C265.873 220.531 268.245 224.982 270.937 228.399L271.454 228.422C276.354 224.237 280.93 219.687 284.582 214.334C285.75 212.621 289.164 203.809 291.622 204.364C295.078 205.173 317.329 202.209 314.8 209.643C308.392 228.483 294.552 241.412 278.863 252.454C280.262 261.471 278.513 272.359 275.908 280.987C260.999 330.37 201.698 355.512 154.162 339.958C129.381 331.846 109.04 317.226 97.2569 293.063C96.2627 290.772 87.4978 269.387 89.3872 267.991C92.172 265.931 107.482 258.12 110.426 257.999C111.656 258.859 112.562 264.067 112.937 265.934C113.742 269.939 115.274 273.212 116.628 276.979C131.789 319.148 187.116 333.358 224.542 310.141C236.598 302.735 245.766 291.436 250.531 278.115C251.94 274.133 252.964 269.416 253.93 265.267C246.328 268.771 229.282 272.384 220.775 273.353C195.886 276.174 161.875 272.724 144.616 252.726C127.434 232.818 137.967 207.897 160.08 197.99C172.579 192.389 179.809 190.946 192.982 189.728ZM216.59 250.326C229.365 249.569 237.83 246.758 249.582 242.474C242.069 228.643 232.709 219.886 217.293 215.303C210.747 213.385 203.934 212.537 197.118 212.797C186.539 213.266 174.431 215.586 166.732 223.464C161.324 228.996 163.615 236.832 169.387 241.059C182.421 250.608 200.064 251.616 215.673 250.454C215.965 250.432 216.382 250.358 216.59 250.326Z"
        fill="currentColor"
      />
      <path
        d="M136.966 55.5249C138.642 55.3789 139.719 55.5066 141.349 55.6795C164.159 58.0962 164.421 87.0859 162.11 104.265C170.842 87.2925 190.592 56.5132 214.582 65.7935C233.604 73.1536 227.677 101.974 220.897 116.003C219.328 119.251 217.473 123.539 216.154 127.056C220.268 121.882 224.35 118.102 229.898 114.438C240.606 107.368 258.345 104.81 266.268 117.258C269.978 123.086 269.811 131.547 268.091 138.011C264.683 150.022 258.223 161.44 251.237 171.726C249.084 174.9 246.19 179.444 242.865 181.282C239.923 182.895 236.444 183.219 233.258 182.176C228.759 180.731 223.804 174.751 225.505 170.477C227.616 165.175 232.841 157.913 236.046 153.006C241.527 144.623 243.414 138.915 246.527 129.806C242.14 132.711 238.658 134.925 234.862 138.744C224.975 148.689 216.674 159.842 207.23 170.157C204.249 173.411 200.812 177.722 197.606 180.578C195.761 182.231 193.679 183.601 191.432 184.645C180.716 189.639 170.602 182.125 173.043 170.534C176.835 152.528 186.77 136.116 193.788 119.158C194.837 117.276 196.172 113.609 197.054 111.514C201.082 101.962 202.68 96.3247 203.909 86.1219C184.726 99.3668 173.464 136.189 160.984 155.703C156.944 162.021 152.733 171.254 144.766 173.159C141.493 173.919 138.052 173.299 135.25 171.447C132.76 169.834 130.903 166.488 131.01 163.572C131.959 137.701 140.924 112.417 139.24 86.2448C139.055 83.3648 138.143 79.9841 137.48 77.1375C129.804 85.6499 126.207 96.1168 123.124 107.025C113.073 142.597 108.405 181.589 108.885 218.548C101.801 221.263 91.7032 223.255 85.1714 226.204C84.5913 217.656 85.6367 202.688 86.0686 193.972C87.6843 161.37 92.131 127.513 102.31 96.4069C105.548 86.5108 109.692 75.5798 116.12 67.2837C121.955 59.753 127.647 56.6499 136.966 55.5249Z"
        fill="currentColor"
      />
    </svg>
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
