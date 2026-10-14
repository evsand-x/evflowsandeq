"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import type * as React from "react";

// Adapted from the official shadcn/ui new-york-v4 Sheet registry component.
// https://ui.shadcn.com/r/styles/new-york-v4/sheet.json
function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal(props: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className = "",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={`fixed inset-0 z-40 bg-black/50 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 motion-safe:transition-opacity ${className}`}
      {...props}
    />
  );
}

function SheetContent({
  className = "",
  children,
  side = "left",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "left" | "right";
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={`bg-ev-sidebar border-ev-border fixed inset-y-0 z-50 flex h-full w-[min(320px,calc(100vw-48px))] flex-col overflow-y-auto shadow-lg motion-safe:transition-transform motion-safe:duration-300 ${side === "left" ? "left-0 border-r data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0" : "right-0 border-l data-[state=closed]:translate-x-full data-[state=open]:translate-x-0"} ${className}`}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className = "", ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sheet-header" className={`flex flex-col gap-1.5 p-4 ${className}`} {...props} />
  );
}

function SheetTitle({
  className = "",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={`text-ev-text font-semibold ${className}`}
      {...props}
    />
  );
}

function SheetDescription({
  className = "",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={`text-ev-muted text-sm ${className}`}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger };
