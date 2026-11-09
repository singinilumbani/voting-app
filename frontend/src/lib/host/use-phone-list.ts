"use client";

import { useMemo } from "react";
import { parsePhoneList } from "@/lib/shared";

export function usePhoneList(input: string) {
  return useMemo(() => {
    const entries = parsePhoneList(input);
    return {
      entries,
      valid: entries.filter((entry) => entry.result.ok),
      invalid: entries.filter((entry) => !entry.result.ok),
    };
  }, [input]);
}
