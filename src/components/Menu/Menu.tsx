import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from '../Icon/Icon';
import './Menu.css';

/**
 * A single selectable item in a {@link Menu}.
 */
export interface MenuItem {
  /** Stable identifier returned to `onSelect`. */
  id: string;
  /** Visible label. */
  label: string;
  /** Optional leading icon (emoji/glyph). */
  icon?: ReactNode;
  /** Disables the item. */
  disabled?: boolean;
  /** When true, shows a busy indicator on the item. */
  loading?: boolean;
  /** Optional test id applied to the item button. */
  testId?: string;
}

export interface MenuProps {
  /** Trigger button label. */
  triggerLabel: string;
  /** Items to render in the dropdown. */
  items: MenuItem[];
  /** Called with the item id when an enabled item is chosen. */
  onSelect: (id: string) => void;
  /** Disables the whole menu trigger. */
  disabled?: boolean;
}

/**
 * Accessible dropdown menu (Fluent-style) used to group secondary actions so
 * the primary surface stays uncluttered. Closes on outside click and Escape.
 */
export function Menu({ triggerLabel, items, onSelect, disabled }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        close();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const handleSelect = (item: MenuItem) => {
    if (item.disabled || item.loading) {
      return;
    }
    onSelect(item.id);
    close();
  };

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        className="menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{triggerLabel}</span>
        <span className="menu__chevron" aria-hidden="true">
          <Icon name="chevron-down" />
        </span>
      </button>

      {open && (
        <div className="menu__popover" role="menu" id={menuId}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="menu__item"
              data-testid={item.testId}
              disabled={item.disabled || item.loading}
              onClick={() => handleSelect(item)}
            >
              {item.icon && (
                <span className="menu__item-icon" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <span className="menu__item-label">{item.label}</span>
              {item.loading && <span className="menu__item-spinner" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Menu;
