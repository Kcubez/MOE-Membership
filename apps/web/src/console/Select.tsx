import * as Primitive from '@radix-ui/react-select';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@radix-ui/react-icons';
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
const EMPTY = '__moe_select_empty__';
type OptionProps = {
  value?: string | number;
  children?: ReactNode;
  disabled?: boolean;
};
type Props = {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
};
export function Select({
  children,
  value,
  defaultValue,
  onValueChange,
  disabled,
  required,
  name,
  id,
  className,
  ...aria
}: Props) {
  const options = Children.toArray(children)
    .filter(isValidElement<OptionProps>)
    .map((child) => ({
      value: String(child.props.value ?? ''),
      text: child.props.children,
      disabled: child.props.disabled,
    }));
  const [internal, setInternal] = useState(
    defaultValue ?? options[0]?.value ?? '',
  );
  const selected = value ?? internal;
  const [open, setOpen] = useState(false),
    [container, setContainer] = useState<HTMLElement>();
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
      }
    };
    // Window capture precedes native <dialog> Escape handling and Radix's document listener.
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [open]);
  const attach = useCallback((node: HTMLButtonElement | null) => {
    trigger.current = node;
    setContainer(node?.closest('dialog') ?? undefined);
  }, []);
  return (
    <Primitive.Root
      value={selected}
      onValueChange={(next) => {
        const result = next === EMPTY ? '' : next;
        setInternal(result);
        onValueChange?.(result);
      }}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      required={required}
      name={name}
    >
      <Primitive.Trigger
        ref={attach}
        id={id}
        {...aria}
        className={`c-select ${className || ''}`}
        onInvalid={(e) => {
          e.preventDefault();
          trigger.current?.focus();
        }}
      >
        <Primitive.Value
          placeholder={options.find((o) => o.value === '')?.text}
        />
        <Primitive.Icon className="c-select-chevron">
          <ChevronDownIcon />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal container={container}>
        <Primitive.Content
          className="c-select-menu"
          position="popper"
          sideOffset={6}
          align="start"
          collisionPadding={12}
          collisionBoundary={container}
          onKeyDownCapture={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            setOpen(false);
          }}
        >
          <Primitive.ScrollUpButton className="c-select-scroll">
            <ChevronUpIcon />
          </Primitive.ScrollUpButton>
          <Primitive.Viewport className="c-select-options">
            {options.map((option) => (
              <Primitive.Item
                className="c-select-option"
                key={option.value}
                value={option.value || EMPTY}
                disabled={option.disabled}
              >
                <Primitive.ItemText>{option.text}</Primitive.ItemText>
                <Primitive.ItemIndicator className="c-select-check">
                  <CheckIcon />
                </Primitive.ItemIndicator>
              </Primitive.Item>
            ))}
          </Primitive.Viewport>
          <Primitive.ScrollDownButton className="c-select-scroll">
            <ChevronDownIcon />
          </Primitive.ScrollDownButton>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
