"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { IconAlert, IconCheck, IconError, IconInfo, IconLoader } from "@/components/web/icons";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
      icons={{
        success: <IconCheck size={18} />,
        info: <IconInfo size={18} />,
        warning: <IconAlert size={18} />,
        error: <IconError size={18} />,
        loading: <IconLoader size={18} className="animate-spin" />,
      }}
      toastOptions={{ classNames: { toast: "ev-toast" } }}
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
