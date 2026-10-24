"use client";
import { Suspense } from "react";
import { AccessPage } from "../access-page";
export default function MatrixPage() { return <Suspense fallback={<p>Memuat...</p>}><AccessPage section="matrix" /></Suspense>; }
