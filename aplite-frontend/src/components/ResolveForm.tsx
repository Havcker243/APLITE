/**
 * UPI resolution form component.
 * Collects lookup input and triggers resolve requests.
 */

﻿import React, { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export type ResolveFormProps = {
  onResolve: (input: string) => Promise<void>;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  buttonText?: string;
};

export function ResolveForm({
  onResolve,
  placeholder = "14-character UPI",
  label = "Enter UPI",
  disabled = false,
  buttonText = "Resolve",
}: ResolveFormProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    try {
      await onResolve(input.trim());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-card">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{label}</Label>
          <div className="flex gap-3">
            <Input
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              className="font-mono"
              disabled={disabled}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <Button variant="hero" onClick={handleSubmit} disabled={disabled || isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  {buttonText}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
