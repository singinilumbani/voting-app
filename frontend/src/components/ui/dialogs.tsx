"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { M3Button, M3TextField } from "./primitives";

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type M3ModalDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}>;

export function M3ModalDialog({
  open,
  onClose,
  title,
  children,
  actions,
  className = "",
}: M3ModalDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    const initialFocus = dialog?.querySelector<HTMLElement>(focusableSelector);
    (initialFocus ?? dialog)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ui-dialog-backdrop">
      <section
        ref={dialogRef}
        className={`ui-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId}>{title}</h2>
        <div>{children}</div>
        {actions && <footer className="ui-dialog__actions">{actions}</footer>}
      </section>
    </div>
  );
}

export type ConfirmDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
}>;

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  cancelLabel,
  confirmLabel,
}: ConfirmDialogProps) {
  return (
    <M3ModalDialog
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <M3Button variant="text" onClick={onClose}>
            {cancelLabel}
          </M3Button>
          <M3Button variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </M3Button>
        </>
      }
    >
      <p>{description}</p>
    </M3ModalDialog>
  );
}

export type NoticeDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel: string;
}>;

export function NoticeDialog({
  open,
  onClose,
  title,
  children,
  closeLabel,
}: NoticeDialogProps) {
  return (
    <M3ModalDialog
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <M3Button onClick={onClose} autoFocus>
          {closeLabel}
        </M3Button>
      }
    >
      {children}
    </M3ModalDialog>
  );
}

export type FormDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}>;

export function FormDialog(props: FormDialogProps) {
  return <M3ModalDialog {...props} />;
}

export type TypedConfirmDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  word: string;
  inputLabel: string;
  cancelLabel: string;
  confirmLabel: string;
}>;

export function TypedConfirmDialog(props: TypedConfirmDialogProps) {
  if (!props.open) return null;
  return <OpenTypedConfirmDialog {...props} />;
}

function OpenTypedConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  word,
  inputLabel,
  cancelLabel,
  confirmLabel,
}: TypedConfirmDialogProps) {
  const [typed, setTyped] = useState("");

  return (
    <M3ModalDialog
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <M3Button variant="text" onClick={onClose}>
            {cancelLabel}
          </M3Button>
          <M3Button
            variant="destructive"
            disabled={typed !== word}
            onClick={onConfirm}
          >
            {confirmLabel}
          </M3Button>
        </>
      }
    >
      <p>{description}</p>
      <M3TextField
        label={inputLabel}
        value={typed}
        onChange={(event) => setTyped(event.currentTarget.value)}
      />
    </M3ModalDialog>
  );
}

export type BottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}>;

export function BottomSheet({ open, onClose, ...props }: BottomSheetProps) {
  return (
    <M3ModalDialog
      {...props}
      open={open}
      onClose={onClose}
      className="ui-dialog--sheet"
    />
  );
}

type SnackbarContextValue = Readonly<{
  show: (message: string, duration?: number) => void;
  dismiss: () => void;
}>;

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export type SnackbarProviderProps = Readonly<{
  children: ReactNode;
}>;

export function SnackbarProvider({ children }: SnackbarProviderProps) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setMessage(null);
  }, []);

  const show = useCallback(
    (nextMessage: string, duration = 4000) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(nextMessage);
      timer.current = setTimeout(dismiss, duration);
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <SnackbarContext.Provider value={{ show, dismiss }}>
      {children}
      {message !== null && (
        <div className="ui-snackbar" role="status" aria-live="polite">
          {message}
        </div>
      )}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error();
  }
  return context;
}

export type SnackbarProps = Readonly<{
  message: string;
}>;

export function Snackbar({ message }: SnackbarProps) {
  return (
    <div className="ui-snackbar" role="status" aria-live="polite">
      {message}
    </div>
  );
}
