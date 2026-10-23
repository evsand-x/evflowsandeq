import type { SVGProps } from "react";

// Ikon Office: satu warna (currentColor), garis 1,75 px, ujung dan sudut tegas mengikuti wordmark evflow.
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5 5" />
  </Icon>
);
export const IconFilter = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" />
  </Icon>
);
export const IconColumns = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5h16v14H4zM9.5 5v14M14.5 5v14" />
  </Icon>
);
export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const IconPencil = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </Icon>
);
export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
  </Icon>
);
export const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 10a6 6 0 0112 0v5l2 3H4l2-3z" />
    <path d="M10 20.5h4" />
  </Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);
export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 11v5M12 8v.5" />
  </Icon>
);
export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17v.5" />
  </Icon>
);
export const IconError = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v5M12 15.5v.5" />
  </Icon>
);
export const IconLoader = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4a8 8 0 018 8" />
  </Icon>
);
export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 10l5 5 5-5" />
  </Icon>
);
export const IconChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 7l-5 5 5 5" />
  </Icon>
);
export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 7l5 5-5 5" />
  </Icon>
);
export const IconBuilding = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 20V5h9v15M14 9h5v11M8 8.5h3M8 12h3M8 15.5h3M3 20h18" />
  </Icon>
);
export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.9-3.8 3.6-6 7-6s6.1 2.2 7 6" />
  </Icon>
);
export const IconLogOut = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
  </Icon>
);

// Tanda sabit dari logo; dipakai sebagai penanda posisi, bukan dekorasi.
export const Crescent = ({ size = 12, ...p }: IconProps) => (
  <svg width={size} height={(size * 14) / 12} viewBox="0 0 12 14" aria-hidden="true" focusable="false" {...p}>
    <path
      d="M8 1C4 1.4 1 4.4 1 7.9 1 11 3.3 13.2 6.5 13 4.3 12.3 2.8 10.3 2.8 7.8 2.8 4.9 4.9 2.3 8 1z"
      fill="currentColor"
    />
  </svg>
);
