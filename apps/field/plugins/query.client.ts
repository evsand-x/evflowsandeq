import { VueQueryPlugin } from "@tanstack/vue-query";
import { defineNuxtPlugin } from "#app";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueQueryPlugin, {
    queryClientConfig: {
      defaultOptions: {
        queries: { staleTime: 30_000, retry: 1 },
        mutations: { retry: false },
      },
    },
  });
});
