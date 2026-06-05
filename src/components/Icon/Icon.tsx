import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowsRotate,
  faKey,
  faClock,
  faWrench,
  faTowerBroadcast,
  faMagnifyingGlass,
  faCheck,
  faCopy,
  faSun,
  faMoon,
  faChevronDown,
  faArrowUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons';

/**
 * Thin wrapper over {@link FontAwesomeIcon} that maps short, intent-based names
 * to the underlying solid icon definitions.
 *
 * Centralizing the icon set here keeps the UI free of stray emoji, ensures the
 * same glyph is reused everywhere, and limits the icon imports to a single
 * module so the bundle only ships what we actually use.
 */
export type IconName =
  | 'reinvite'
  | 'otp'
  | 'clock'
  | 'wrench'
  | 'monitor'
  | 'search'
  | 'check'
  | 'copy'
  | 'sun'
  | 'moon'
  | 'chevron-down'
  | 'external';

const ICONS: Record<IconName, IconDefinition> = {
  reinvite: faArrowsRotate,
  otp: faKey,
  clock: faClock,
  wrench: faWrench,
  monitor: faTowerBroadcast,
  search: faMagnifyingGlass,
  check: faCheck,
  copy: faCopy,
  sun: faSun,
  moon: faMoon,
  'chevron-down': faChevronDown,
  external: faArrowUpRightFromSquare,
};

export interface IconProps {
  /** Intent-based icon name (see {@link IconName}). */
  name: IconName;
  /** Optional className forwarded to the SVG. */
  className?: string;
  /** Optional fixed-width rendering for aligned lists. */
  fixedWidth?: boolean;
  /** Spins the icon (used for busy/loading states). */
  spin?: boolean;
  /** Accessible title; when omitted the icon is decorative (aria-hidden). */
  title?: string;
}

export function Icon({ name, className, fixedWidth, spin, title }: IconProps) {
  return (
    <FontAwesomeIcon
      icon={ICONS[name]}
      className={className}
      fixedWidth={fixedWidth}
      spin={spin}
      title={title}
      aria-hidden={title ? undefined : true}
    />
  );
}

export default Icon;
