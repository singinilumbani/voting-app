import { useMemo } from "react";
import messages from "@/locales/en.json";

type TranslationValue = string | { readonly [key: string]: TranslationValue };
type TranslationParams = Readonly<
  Record<string, string | number | Date | undefined>
>;
export type Translator = (key: string, params?: TranslationParams) => string;

function findValue(key: string): TranslationValue | undefined {
  let value: unknown = messages;

  for (const part of key.split(".")) {
    if (typeof value !== "object" || value === null) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[part];
  }

  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    return value as TranslationValue;
  }
  return undefined;
}

function interpolate(template: string, params: TranslationParams): string {
  return template.replace(
    /\{([A-Za-z0-9_]+)\}/g,
    (placeholder, name: string) => {
      const value = params[name];
      if (value === undefined) return placeholder;
      return value instanceof Date ? value.toLocaleString("en") : String(value);
    },
  );
}

export function getT(): Translator {
  return (key, params = {}) => {
    const value = findValue(key);
    if (value === undefined) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Missing translation: ${key}`);
      }
      return key;
    }

    if (typeof value === "string") return interpolate(value, params);

    const count = params.count;
    const category =
      typeof count === "number"
        ? new Intl.PluralRules("en").select(count)
        : undefined;
    const forms = value as Record<string, unknown>;
    const template =
      (category && forms[category]) ??
      forms.other ??
      Object.values(forms).find(
        (candidate): candidate is string => typeof candidate === "string",
      );

    if (typeof template !== "string") {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Missing translation form: ${key}`);
      }
      return key;
    }

    return interpolate(template, params);
  };
}

export function useT(): Translator {
  return useMemo(() => getT(), []);
}
