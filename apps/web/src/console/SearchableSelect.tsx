import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDownIcon, CheckIcon } from '@radix-ui/react-icons';
import { useText } from './i18n';
type Option = { value: string; text: ReactNode; disabled?: boolean };
export function SearchableSelect({
  onLoadMore,
  options,
  value,
  onValueChange,
  searchValue,
  onSearchChange,
  loading,
  disabled,
  required,
  name,
  id,
  className,
  ...aria
}: {
  onLoadMore?: () => void;
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}) {
  const t = useText();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const labels = useRef(new Map<string, ReactNode>());
  for (const option of options)
    if (option.value) labels.current.set(option.value, option.text);
  const listId = useId();
  const choices = options.filter((o) => o.value && !o.disabled);
  useEffect(() => {
    setActive(-1);
  }, [searchValue, loading]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function choose(option: Option) {
    onValueChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      ref={root}
      className="c-combobox"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <input
        className="c-combobox-validation"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        readOnly
        required={required}
        name={name}
        onInvalid={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      />
      <button
        ref={trigger}
        id={id}
        type="button"
        className={`c-select ${className ?? ''}`}
        {...aria}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span>
          {labels.current.get(value) ??
            options.find((o) => !o.value)?.text ??
            t('Search')}
        </span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="c-combobox-menu">
          <input
            ref={input}
            type="search"
            role="combobox"
            aria-label={
              aria['aria-label']
                ? `${t('Search')}: ${aria['aria-label']}`
                : t('Search')
            }
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              active >= 0 ? `${listId}-${active}` : undefined
            }
            placeholder={t('Search')}
            value={searchValue}
            maxLength={120}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const next = choices.length
                  ? (active +
                      (e.key === 'ArrowDown' ? 1 : -1) +
                      choices.length) %
                    choices.length
                  : -1;
                setActive(next);
                document
                  .getElementById(`${listId}-${next}`)
                  ?.scrollIntoView({ block: 'nearest' });
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!loading && choices[active]) choose(choices[active]);
              }
              if (e.key === 'Tab') setOpen(false);
            }}
          />
          <div
            id={listId}
            role="listbox"
            aria-label={aria['aria-label']}
            aria-busy={loading}
            className="c-combobox-options"
          >
            {loading ? (
              <p role="status">{t('Loading…')}</p>
            ) : choices.length ? (
              choices.map((o, i) => (
                <div
                  key={o.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={value === o.value}
                  className={`c-select-option ${active === i ? 'is-highlighted' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                >
                  {o.text}
                  {value === o.value && <CheckIcon />}
                </div>
              ))
            ) : (
              <p role="status">{t('No results found.')}</p>
            )}
          </div>
          {onLoadMore && (
            <button
              type="button"
              className="c-button secondary small"
              disabled={loading}
              onClick={onLoadMore}
            >
              {t('Load more')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
