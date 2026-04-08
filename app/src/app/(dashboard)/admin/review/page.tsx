"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminReviewPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/ingest"); }, [router]);
  return null;
}
