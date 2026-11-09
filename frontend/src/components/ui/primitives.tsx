"use client";

import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Icon } from "./Icon";

export type M3ButtonVariant =
  "filled" | "tonal" | "outlined" | "text" | "destructive" | "fab";

export type M3ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: M3ButtonVariant;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function M3Button({
  variant = "filled",
  loading = false,
  leadingIcon,
  trailingIcon,
  disabled,
  className = "",
  children,
  ...props
}: M3ButtonProps) {
  return (
    <button
      {...props}
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <span className="ui-button__spinner" aria-hidden="true" />
      ) : (
        leadingIcon
      )}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id?: string;
  label: string;
  helperText?: string;
  error?: string;
  trailingIcon?: ReactNode;
  inputClassName?: string;
};

function Field({
  id: providedId,
  label,
  helperText,
  error,
  trailingIcon,
  inputClassName = "",
  className = "",
  ...inputProps
}: FieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`ui-field ${className}`.trim()}>
      <div
        className={`ui-field__control ${error ? "ui-field__control--error" : ""}`}
      >
        <input
          {...inputProps}
          id={id}
          className={`ui-field__input ${inputClassName}`.trim()}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        <label className="ui-field__label" htmlFor={id}>
          {label}
        </label>
        {trailingIcon && (
          <span className="ui-field__trailing">{trailingIcon}</span>
        )}
      </div>
      {helperText && (
        <span className="ui-field__helper" id={helperId}>
          {helperText}
        </span>
      )}
      {error && (
        <span className="ui-field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export type M3TextFieldProps = FieldProps;

export function M3TextField(props: M3TextFieldProps) {
  return <Field {...props} />;
}

export type PasswordFieldProps = Omit<FieldProps, "type" | "trailingIcon"> & {
  showPasswordLabel: string;
  hidePasswordLabel: string;
};

export function PasswordField({
  showPasswordLabel,
  hidePasswordLabel,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? hidePasswordLabel : showPasswordLabel;

  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      autoComplete={props.autoComplete ?? "current-password"}
      trailingIcon={
        <button
          type="button"
          aria-label={label}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="ui-icon-button"
        >
          <Icon name={visible ? "visibility_off" : "visibility"} />
        </button>
      }
    />
  );
}

export type NumberFieldProps = Omit<FieldProps, "type">;

export function NumberField(props: NumberFieldProps) {
  return <Field {...props} type="number" inputMode="decimal" />;
}

export type DateTimeFieldProps = Omit<FieldProps, "type">;

export function DateTimeField(props: DateTimeFieldProps) {
  return <Field {...props} type="datetime-local" />;
}

export type M3SelectOption = Readonly<{ value: string; label: string }>;

export type M3SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id"
> &
  Readonly<{
    id?: string;
    label: string;
    options: readonly M3SelectOption[];
    helperText?: string;
    error?: string;
    placeholder?: string;
  }>;

export function M3Select({
  id: providedId,
  label,
  options,
  helperText,
  error,
  placeholder,
  className = "",
  ...props
}: M3SelectProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`ui-field ${className}`.trim()}>
      <label className="ui-field__label" htmlFor={id}>
        {label}
      </label>
      <select
        {...props}
        id={id}
        className="ui-field__control ui-select"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText && (
        <span className="ui-field__helper" id={helperId}>
          {helperText}
        </span>
      )}
      {error && (
        <span className="ui-field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export type ToggleProps = Readonly<{
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: string;
}>;

export function Toggle({
  label,
  checked,
  onCheckedChange,
  disabled = false,
  description,
}: ToggleProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <div className="ui-toggle">
      <div>
        <div id={id}>{label}</div>
        {description && (
          <div className="ui-field__helper" id={descriptionId}>
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        aria-describedby={descriptionId}
        disabled={disabled}
        className="ui-switch"
        onClick={() => onCheckedChange(!checked)}
      >
        <span className="ui-switch__thumb" />
      </button>
    </div>
  );
}

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> &
  Readonly<{ label: string; helperText?: string; error?: string }>;

export function Checkbox({
  label,
  helperText,
  error,
  id: providedId,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="ui-checkbox">
      <input
        {...props}
        id={id}
        type="checkbox"
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [helperId, errorId].filter(Boolean).join(" ") || undefined
        }
      />
      <label htmlFor={id}>{label}</label>
      {helperText && (
        <span className="ui-field__helper" id={helperId}>
          {helperText}
        </span>
      )}
      {error && (
        <span className="ui-field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export type M3CardProps = Readonly<{
  children: ReactNode;
  className?: string;
  as?: "article" | "section" | "div";
}>;

export function M3Card({
  children,
  className = "",
  as: Element = "article",
}: M3CardProps) {
  return (
    <Element className={`ui-card ${className}`.trim()}>{children}</Element>
  );
}

export type M3BannerProps = Readonly<{
  variant?: "info" | "warning" | "error";
  children: ReactNode;
  title?: string;
  className?: string;
}>;

export function M3Banner({
  variant = "info",
  children,
  title,
  className = "",
}: M3BannerProps) {
  return (
    <div
      className={`ui-banner ui-banner--${variant} ${className}`.trim()}
      role={variant === "error" ? "alert" : "status"}
    >
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

export type StatusBadgeProps = Readonly<{
  status: "neutral" | "success" | "warning" | "error";
  children: ReactNode;
}>;

export function StatusBadge({ status, children }: StatusBadgeProps) {
  return <span className={`ui-status ui-status--${status}`}>{children}</span>;
}

export type ChipProps = Readonly<{
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}>;

export function Chip({
  children,
  selected = false,
  onClick,
  onRemove,
  removeLabel,
}: ChipProps) {
  const content = onClick ? (
    <button
      type="button"
      className="ui-chip"
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  ) : (
    <span className="ui-chip">{children}</span>
  );

  return (
    <span className="ui-chip-container">
      {content}
      {onRemove && removeLabel && (
        <button type="button" aria-label={removeLabel} onClick={onRemove}>
          <Icon name="close" />
        </button>
      )}
    </span>
  );
}

export type SkeletonLoaderProps = Readonly<{
  label: string;
  count?: number;
  className?: string;
}>;

export function SkeletonLoader({
  label,
  count = 1,
  className = "",
}: SkeletonLoaderProps) {
  return (
    <div role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: Math.max(1, count) }, (_, index) => (
        <div
          className={`ui-skeleton ${className}`.trim()}
          key={index}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export type EmptyStateProps = Readonly<{
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}>;

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <section className="ui-empty-state">
      {icon}
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export type ProgressBarProps = Readonly<{
  value: number;
  max?: number;
  label: string;
}>;

export function ProgressBar({ value, max = 100, label }: ProgressBarProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? value : 0;
  const percent = Math.min(100, Math.max(0, (safeValue / safeMax) * 100));
  return (
    <div
      className="ui-progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.min(safeMax, Math.max(0, safeValue))}
      aria-valuemin={0}
      aria-valuemax={safeMax}
    >
      <div className="ui-progress__bar" style={{ width: `${percent}%` }} />
    </div>
  );
}

export type TabDefinition = Readonly<{
  id: string;
  label: string;
  content: ReactNode;
}>;

export type TabsProps = Readonly<{
  tabs: readonly TabDefinition[];
  label: string;
  defaultTab?: string;
}>;

export function Tabs({ tabs, label, defaultTab }: TabsProps) {
  const tabsId = useId();
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? "");

  function moveFocus(currentIndex: number, key: string) {
    if (tabs.length === 0) return;
    let nextIndex = currentIndex;
    if (key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (key === "Home") nextIndex = 0;
    if (key === "End") nextIndex = tabs.length - 1;
    const nextTab = tabs[nextIndex];
    if (nextTab) setActiveTab(nextTab.id);
    document.getElementById(`${tabsId}-tab-${nextTab?.id}`)?.focus();
  }

  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  return (
    <div>
      <div className="ui-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            type="button"
            className="ui-tab"
            id={`${tabsId}-tab-${tab.id}`}
            role="tab"
            key={tab.id}
            aria-selected={tab.id === active?.id}
            aria-controls={`${tabsId}-panel-${tab.id}`}
            tabIndex={tab.id === active?.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                moveFocus(index, event.key);
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active && (
        <div
          role="tabpanel"
          id={`${tabsId}-panel-${active.id}`}
          aria-labelledby={`${tabsId}-tab-${active.id}`}
          tabIndex={0}
        >
          {active.content}
        </div>
      )}
    </div>
  );
}

export type PageHeaderProps = Readonly<{
  title: string;
  description?: string;
  actions?: ReactNode;
}>;

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="ui-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions}
    </header>
  );
}

export type AuthCardProps = Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}>;

export function AuthCard({
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <M3Card className="ui-auth-card">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {children}
      {footer && <footer>{footer}</footer>}
    </M3Card>
  );
}

export type CopyLinkFieldProps = Readonly<{
  label: string;
  value: string;
  copyLabel: string;
  copiedLabel: string;
  copyErrorLabel: string;
}>;

export function CopyLinkField({
  label,
  value,
  copyLabel,
  copiedLabel,
  copyErrorLabel,
}: CopyLinkFieldProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copyValue() {
    if (!navigator.clipboard) {
      setCopied(false);
      setFailed(true);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
    } catch {
      setCopied(false);
      setFailed(true);
    }
  }

  return (
    <div className="ui-copy-link">
      <M3TextField label={label} value={value} readOnly />
      <M3Button
        type="button"
        variant="outlined"
        onClick={copyValue}
        leadingIcon={<Icon name="content_copy" />}
      >
        {copied ? copiedLabel : copyLabel}
      </M3Button>
      {failed && (
        <span className="ui-field__error" role="alert">
          {copyErrorLabel}
        </span>
      )}
    </div>
  );
}
