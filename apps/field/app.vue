<script setup lang="ts">
import { useRuntimeConfig } from '#imports'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
const officeUrl = useRuntimeConfig().public.officeUrl
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
    <Card class="w-full max-w-md">
      <CardHeader>
        <p class="text-xl font-bold tracking-tight">evflow</p>
        <CardTitle class="pt-4 text-2xl">Lapangan</CardTitle>
      </CardHeader>
      <CardContent class="space-y-5">
        <p class="text-sm text-muted-foreground">
          Aplikasi sales dan gudang sedang disiapkan. Gunakan web kantor untuk akses yang sudah tersedia.
        </p>
        <Button as-child class="min-h-11">
          <a :href="officeUrl">Buka web kantor</a>
        </Button>
      </CardContent>
    </Card>
  </main>
</template>
