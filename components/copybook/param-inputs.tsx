"use client";

import type { ParamInfo } from "@copybook/core/fill";
import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ParamInputsProps {
  onChange: (name: string, value: string) => void;
  params: readonly ParamInfo[];
  values: Readonly<Record<string, string>>;
}

/**
 * An input per param. Each shows the value it rendered with as its
 * placeholder, except a real secret, which never leaves the prompt.
 */
export const ParamInputs = ({ onChange, params, values }: ParamInputsProps) => {
  const id = useId();

  return (
    <div className="grid gap-3 border-b p-3 sm:grid-cols-2">
      {params.map((param) => {
        const inputId = `${id}-${param.name}`;
        const isRealSecret = param.secret && !param.placeholder;
        return (
          <div className="flex min-w-0 flex-col gap-1.5" key={param.name}>
            <Label htmlFor={inputId}>{param.name}</Label>
            <Input
              autoComplete="off"
              id={inputId}
              onChange={(event) => onChange(param.name, event.target.value)}
              placeholder={isRealSecret ? undefined : param.value}
              spellCheck={false}
              type={param.secret ? "password" : "text"}
              value={values[param.name] ?? ""}
            />
          </div>
        );
      })}
    </div>
  );
};
