"use client";
import { RecordBadge } from "@/components/web/page-frame";
export function tone(label: string) {
  if (/batal|ditahan|ditolak|perlu revisi|dibalik/i.test(label)) return "danger";
  if (/backorder|sebagian|menunggu|belum|draft|perjalanan/i.test(label)) return "warning";
  if (
    /selesai|lunas|terkirim|diterima|lengkap|closed|dikonfirmasi|diposting|terverifikasi|dibukukan/i.test(
      label,
    )
  )
    return "success";
  if (/open|diterbitkan|teralokasi/i.test(label)) return "info";
  return "neutral";
}
export function Tone({ children }: { children: string }) {
  return <RecordBadge state={tone(children)} label={children} />;
}
