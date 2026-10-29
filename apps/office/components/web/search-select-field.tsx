"use client";

import { useId, useRef, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { IconCheck as Check, IconSearch as Search } from "@/components/web/icons";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string; code?: string; keywords?: string[] };

/**
 * Single choice that is typed into directly: the field itself is the search box and matching
 * options open below it (combobox). Used where the list is long, e.g. Pelanggan on SO.
 */
export function SearchSelectField({
  label,
  value,
  options,
  onChange,
  error,
  hint,
  placeholder = "Ketik untuk mencari…",
  disabled = false,
  loading = false,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.id === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  // While not searching the field shows the chosen option; typing starts a new search.
  const text = query ?? selected?.name ?? "";
  const close = () => {
    setOpen(false);
    setQuery(null);
  };
  return (
    <Field data-invalid={!!error}>
      {/* cmdk names the input with its own hidden label; the visible label focuses the field. */}
      <FieldLabel onClick={() => inputRef.current?.focus()}>{label}</FieldLabel>
      <CommandPrimitive shouldFilter className="web-search-select" loop label={label}>
        <Popover open={open && !disabled} onOpenChange={(next) => (next ? setOpen(true) : close())}>
          <PopoverAnchor asChild>
            <div className="web-search-select-box">
              <Search aria-hidden="true" className="web-search-select-icon" />
              <CommandPrimitive.Input
                ref={inputRef}
                data-slot="input"
                disabled={disabled}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
                autoComplete="off"
                placeholder={loading ? "Memuat…" : placeholder}
                className={cn(
                  "border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50",
                )}
                value={text}
                onValueChange={(next) => {
                  setQuery(next);
                  setOpen(true);
                }}
                onFocus={(event) => {
                  event.currentTarget.select();
                  setOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") close();
                }}
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            className="web-selection-popup web-search-select-popup"
            align="start"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              // Clicking back into the field keeps the list open.
              if ((event.target as Element | null)?.closest?.(".web-search-select-box"))
                event.preventDefault();
            }}
          >
            <CommandList>
              <CommandEmpty>Tidak ada yang cocok dengan pencarian.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    keywords={[option.name, option.code ?? "", ...(option.keywords ?? [])]}
                    onSelect={() => {
                      onChange(option.id);
                      close();
                    }}
                  >
                    <Check
                      aria-hidden="true"
                      className={
                        option.id === value ? "web-choice-checked" : "web-choice-unchecked"
                      }
                    />
                    <span>{option.name}</span>
                    {option.code && <span className="web-search-select-code">{option.code}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </PopoverContent>
        </Popover>
      </CommandPrimitive>
      {hint}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
