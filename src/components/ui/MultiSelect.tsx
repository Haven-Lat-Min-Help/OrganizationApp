import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './MultiSelect.module.css';

export interface MultiSelectOption {
  id: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface PanelRect {
  top: number;
  left: number;
  width: number;
}

/**
 * Checkbox-list dropdown for selecting zero or more options by id. Ported from
 * WebApp/src/components/ui/MultiSelect.tsx with inline SVG icons in place of
 * lucide-react (this app doesn't depend on it). The panel renders through a
 * portal into document.body, positioned from the trigger's bounding rect —
 * plain absolute positioning would get clipped by Card's `overflow: hidden`.
 */
export function MultiSelect({ options, selected, onChange, placeholder = 'Select…', disabled }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<PanelRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function updateRect() {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      setRect({ top: bounds.bottom + 4, left: bounds.left, width: bounds.width });
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((existing) => existing !== id) : [...selected, id]);
  }

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find((option) => option.id === selected[0])?.label ?? placeholder)
        : `${selected.length} selected`;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-expanded={open}
      >
        <span className={selected.length === 0 ? styles.placeholder : undefined}>{summary}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            className={styles.panel}
            role="listbox"
            aria-multiselectable="true"
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            {options.length === 0 && <p className={styles.empty}>No options available</p>}
            {options.map((option) => {
              const isSelected = selected.includes(option.id);
              return (
                <button
                  type="button"
                  key={option.id}
                  role="option"
                  aria-selected={isSelected}
                  className={styles.option}
                  onClick={() => toggle(option.id)}
                >
                  <span className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
