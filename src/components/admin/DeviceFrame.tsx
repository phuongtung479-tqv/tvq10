import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useAdmin } from "@/lib/use-admin";

/** Cờ cho biết trang đang chạy bên trong khung xem thử (ẩn thanh Admin). */
export function isDevicePreview() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("device_preview");
}

/**
 * Khung xem trước theo kích thước thiết bị. Dùng iframe để các breakpoint
 * responsive thật sự áp dụng đúng với bề rộng 375px / 768px.
 */
export function DeviceFrame({ children }: { children: ReactNode }) {
  const { authed, device, deviceSizes, previewEnabled } = useAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [inPreview, setInPreview] = useState(true);

  useEffect(() => setInPreview(isDevicePreview()), []);

  const size = deviceSizes[device];
  if (!authed || inPreview || !previewEnabled) return <>{children}</>;

  return (
    <div className="flex justify-center bg-neutral-200 px-2 pb-6 dark:bg-neutral-800 sm:px-4">
      <iframe
        title={`Xem thử ${device}`}
        src={`${pathname}?device_preview=1`}
        style={{ width: size.width, height: size.height, maxWidth: "100%" }}
        className="rounded-2xl border-[10px] border-neutral-900 bg-background shadow-2xl"
      />
    </div>
  );
}
