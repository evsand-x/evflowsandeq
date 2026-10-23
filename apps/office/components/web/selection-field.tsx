"use client";

import { useId, useState } from "react";
import { IconCheck as Check, IconChevronDown as ChevronDown } from "@/components/web/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

/** Searchable single/multiple choice shared by operational forms. */
export function SelectionField({
  label,
  value,
  options,
  onChange,
  multiple = false,
  onSearch,
  error,
  hideLabel = false,
  placeholder = "Pilih…",
}: {
  label: string;
  value: string[];
  options: { id: string; name: string; code?: string; keywords?: string[] }[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  onSearch?: ((query: string) => void) | undefined;
  error?: string | undefined;
  hideLabel?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.filter((option) => value.includes(option.id));
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            id={id}
            aria-label={label}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className="web-multi-trigger"
          >
            <span>{selected.map((option) => option.name).join(", ") || placeholder}</span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="web-selection-popup" align="start">
          <Command shouldFilter={!onSearch}>
            <CommandInput
              aria-label={`Cari ${label}`}
              placeholder="Cari…"
              value={search}
              onValueChange={(query) => {
                setSearch(query);
                onSearch?.(query);
              }}
            />
            <CommandList>
              <CommandEmpty>Tidak ada pilihan yang cocok.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    keywords={[option.name, option.code ?? "", ...(option.keywords ?? [])]}
                    onSelect={() => {
                      onChange(
                        multiple
                          ? value.includes(option.id)
                            ? value.filter((item) => item !== option.id)
                            : [...value, option.id]
                          : [option.id],
                      );
                      if (!multiple) setOpen(false);
                    }}
                  >
                    <Check
                      aria-hidden="true"
                      className={
                        value.includes(option.id) ? "web-choice-checked" : "web-choice-unchecked"
                      }
                    />
                    <span>{option.name}</span>
                    <span className="sr-only">
                      {value.includes(option.id) ? "Dipilih" : "Belum dipilih"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
