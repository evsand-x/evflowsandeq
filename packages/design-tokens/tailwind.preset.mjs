export default {
  theme: {
    extend: {
      colors: {
        ev: {
          primary: "hsl(var(--primary))",
          "primary-dark": "hsl(var(--foreground))",
          "primary-soft": "hsl(var(--accent))",
          background: "hsl(var(--background))",
          sidebar: "hsl(var(--sidebar))",
          card: "hsl(var(--card))",
          border: "hsl(var(--border))",
          text: "hsl(var(--foreground))",
          muted: "hsl(var(--muted-foreground))",
          success: "var(--ev-color-success)",
          "success-soft": "var(--ev-color-success-soft)",
          warning: "var(--ev-color-warning)",
          "warning-soft": "var(--ev-color-warning-soft)",
          danger: "hsl(var(--destructive))",
          "danger-soft": "var(--ev-color-danger-soft)",
        },
      },
      borderRadius: {
        ev: "var(--ev-radius-card)",
        "ev-control": "var(--ev-radius-control)",
      },
    },
  },
};
