import { useEffect, useState } from "react";
import { getUtmPayload } from "@/lib/utm-hub";

/**
 * Nhét TOÀN BỘ tham số thu gom được (Hub UTM Catch-All) vào các
 * <input type="hidden"> để khi form submit theo kiểu HTML truyền thống,
 * backend vẫn nhận đủ 100% "vết tích" của đường link.
 *
 * Chỉ render sau khi hydrate để tránh lệch SSR.
 */
export function UtmHiddenFields({
  model = "last",
  prefix = "",
}: {
  model?: "first" | "last";
  prefix?: string;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      setFields(getUtmPayload(model));
    } catch {
      setFields({});
    }
  }, [model]);

  return (
    <>
      {Object.entries(fields).map(([key, value]) => (
        <input
          key={key}
          type="hidden"
          name={`${prefix}${key}`}
          value={value ?? ""}
          readOnly
        />
      ))}
    </>
  );
}
