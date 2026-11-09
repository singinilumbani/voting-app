"use client";

import {
  useState,
  type ChangeEventHandler,
  type FocusEventHandler,
} from "react";
import { useT } from "@/lib/i18n";
import {
  normalizePhoneInput,
  type NormalizedPhone,
  type PhoneNormalizationReason,
} from "@/lib/shared";
import { M3TextField, type M3TextFieldProps } from "./primitives";

const reasonKeys: Record<PhoneNormalizationReason, string> = {
  TOO_SHORT: "errors.phone.too_short",
  TOO_LONG: "errors.phone.too_long",
  NOT_MOBILE: "errors.phone.not_mobile",
  SPREADSHEET_DAMAGED: "errors.phone.spreadsheet_damaged",
  EMPTY: "errors.phone.empty",
  INVALID_CHARACTERS: "errors.phone.invalid_characters",
};

export type PhoneFieldProps = Omit<
  M3TextFieldProps,
  "type" | "inputMode" | "value" | "defaultValue" | "error"
> &
  Readonly<{
    value?: string;
    defaultValue?: string;
    error?: string;
    onChange?: ChangeEventHandler<HTMLInputElement>;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    onNormalizedChange?: (phone: NormalizedPhone) => void;
  }>;

export function PhoneField({
  value,
  defaultValue,
  error,
  onChange,
  onBlur,
  onNormalizedChange,
  ...props
}: PhoneFieldProps) {
  const t = useT();
  const [uncontrolledValue, setUncontrolledValue] = useState(
    value ?? defaultValue ?? "",
  );
  const [blurred, setBlurred] = useState(false);
  const currentValue = value ?? uncontrolledValue;
  const parsed = normalizePhoneInput(currentValue);
  const validationError =
    blurred && !parsed.ok ? t(reasonKeys[parsed.reason]) : undefined;
  const preview =
    parsed.ok && `+${parsed.canonical}`.startsWith("+265")
      ? `+265 ${parsed.canonical.slice(3, 5)} ${parsed.canonical.slice(5, 8)} ${parsed.canonical.slice(8)}`
      : parsed.ok
        ? parsed.display
        : undefined;

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (value === undefined) setUncontrolledValue(event.currentTarget.value);
    setBlurred(false);
    onChange?.(event);
  };

  const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    const result = normalizePhoneInput(event.currentTarget.value);
    setBlurred(true);
    if (result.ok) {
      if (value === undefined) setUncontrolledValue(result.display);
      onNormalizedChange?.(result);
    }
    onBlur?.(event);
  };

  return (
    <M3TextField
      {...props}
      type="tel"
      inputMode="tel"
      value={currentValue}
      onChange={handleChange}
      onBlur={handleBlur}
      helperText={
        preview ? t("phoneField.preview", { phone: preview }) : props.helperText
      }
      error={error ?? validationError}
    />
  );
}
