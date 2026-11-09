"use client";

import {
  useState,
  type ChangeEventHandler,
  type FocusEventHandler,
} from "react";
import { useT } from "@/lib/i18n";
import {
  formatTokenInput,
  normalizeTokenInput,
  type TokenNormalizationResult,
} from "@/lib/shared";
import { M3TextField, type M3TextFieldProps } from "./primitives";

export type CodeFieldProps = Omit<
  M3TextFieldProps,
  "type" | "value" | "defaultValue" | "error" | "onChange" | "onBlur"
> &
  Readonly<{
    value?: string;
    defaultValue?: string;
    error?: string;
    onValueChange?: (value: string) => void;
    onNormalizedChange?: (
      result: Extract<TokenNormalizationResult, { ok: true }>,
    ) => void;
  }>;

export function CodeField({
  value,
  defaultValue,
  error,
  onValueChange,
  onNormalizedChange,
  ...props
}: CodeFieldProps) {
  const t = useT();
  const [uncontrolledValue, setUncontrolledValue] = useState(
    formatTokenInput(value ?? defaultValue ?? ""),
  );
  const [blurred, setBlurred] = useState(false);
  const currentValue =
    value === undefined ? uncontrolledValue : formatTokenInput(value);
  const validation = normalizeTokenInput(currentValue);
  const validationError =
    blurred && currentValue && !validation.ok
      ? t(
          validation.reason === "INVALID_LENGTH"
            ? "errors.token.invalid_length"
            : "errors.token.invalid_characters",
        )
      : undefined;

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const formatted = formatTokenInput(event.currentTarget.value);
    if (value === undefined) setUncontrolledValue(formatted);
    setBlurred(false);
    onValueChange?.(formatted);
  };

  const handleBlur: FocusEventHandler<HTMLInputElement> = () => {
    setBlurred(true);
    const result = normalizeTokenInput(currentValue);
    if (result.ok) onNormalizedChange?.(result);
  };

  return (
    <M3TextField
      {...props}
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      value={currentValue}
      helperText={props.helperText ?? t("codeField.helperText")}
      onChange={handleChange}
      onBlur={handleBlur}
      error={error ?? validationError}
    />
  );
}
