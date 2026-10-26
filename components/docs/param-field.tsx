"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ParamFieldProps {
  label: string;
  onChange: (value: string) => void;
  value: string;
}

/** A labeled input for editing one param in a live preview. */
export const ParamField = ({ label, onChange, value }: ParamFieldProps) => {
  const id = useId();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
};
