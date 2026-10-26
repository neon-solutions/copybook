import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import type { ParamInfo } from "./types";

export type FormValues = Record<string, string>;

/** Form values start from each param's example, then its default. */
export const initialValues = (params: Record<string, ParamInfo>): FormValues =>
  Object.fromEntries(
    Object.entries(params).map(([name, param]) => {
      const value = param.example ?? param.default;
      return [name, value === undefined ? "" : String(value)];
    })
  );

/** Converts form strings back to param types, dropping empty values. */
export const toParamValues = (
  params: Record<string, ParamInfo>,
  values: FormValues
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [name, param] of Object.entries(params)) {
    const value = values[name] ?? "";
    if (value === "") {
      continue;
    }
    if (param.kind === "number") {
      result[name] = Number(value);
    } else if (param.kind === "boolean") {
      result[name] = value === "true";
    } else {
      result[name] = value;
    }
  }
  return result;
};

interface FieldProps {
  name: string;
  onChange: (value: string) => void;
  param: ParamInfo;
  value: string;
}

const ParamInput = ({ name, onChange, param, value }: FieldProps) => {
  const id = useId();
  const options =
    param.kind === "boolean" ? ["true", "false"] : (param.values ?? []);
  const hasOptions = param.kind === "enum" || param.kind === "boolean";

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        <span className="font-mono">{name}</span>
        <span className="text-muted-foreground font-normal">
          {param.kind}
          {param.optional ? ", optional" : ""}
        </span>
      </Label>
      {hasOptions ? (
        <NativeSelect
          id={id}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {param.optional ? (
            <NativeSelectOption value="">(none)</NativeSelectOption>
          ) : null}
          {options.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : (
        <Input
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={param.placeholder}
          type={param.kind === "secret" ? "password" : "text"}
          value={value}
        />
      )}
      {param.description ? (
        <p className="text-muted-foreground text-xs">{param.description}</p>
      ) : null}
    </div>
  );
};

interface ParamsFormProps {
  onChange: (values: FormValues) => void;
  params: Record<string, ParamInfo>;
  values: FormValues;
}

export const ParamsForm = ({ onChange, params, values }: ParamsFormProps) => {
  const names = Object.keys(params);
  if (names.length === 0) {
    return <p className="text-muted-foreground text-sm">No params.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {names.map((name) => {
        const param = params[name];
        return param ? (
          <ParamInput
            key={name}
            name={name}
            onChange={(value) => onChange({ ...values, [name]: value })}
            param={param}
            value={values[name] ?? ""}
          />
        ) : null;
      })}
    </div>
  );
};
