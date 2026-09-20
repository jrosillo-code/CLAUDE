"use client";

import { useEffect } from "react";
import { installErrorReporting } from "@/lib/monitor";

// Mounted once in the root layout: uncaught errors and rejections anywhere
// in the app reach /api/errors (see lib/monitor.ts for what is and is not
// sent).
export default function ErrorReporter() {
  useEffect(() => installErrorReporting(), []);
  return null;
}
