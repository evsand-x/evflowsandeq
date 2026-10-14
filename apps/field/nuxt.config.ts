export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: "2025-09-01",
  modules: ["@nuxtjs/tailwindcss"],
  components: false,
  tailwindcss: { cssPath: "~/assets/css/main.css" },
  css: [],
  runtimeConfig: {
    public: {
      officeUrl: process.env.NUXT_PUBLIC_OFFICE_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000/" : "/"),
    },
  },
  build: { transpile: ["@evflow/ui-vue"] },
  app: {
    baseURL: "/lapangan/",
    head: {
      title: "evflow Lapangan",
      meta: [{ name: "theme-color", content: "#171717" }],
    },
  },
});
