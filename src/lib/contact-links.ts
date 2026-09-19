import type { SiteConfig } from "@/config/site-config";

/** Chuẩn hoá số điện thoại & link Zalo từ cấu hình Admin. */
export function contactLinks(config: SiteConfig) {
  const c = config.floatingContact;
  const phone = (c.hotline || "").replace(/[^\d+]/g, "");
  const zaloRaw = (c.zalo || "").trim();
  const zaloDigits = zaloRaw.replace(/\D/g, "");
  const safeExternalHref = (value: string) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.toString() : "";
    } catch {
      return "";
    }
  };

  let zaloHref = "";
  if (/^https:\/\//i.test(zaloRaw)) zaloHref = safeExternalHref(zaloRaw);
  else if (zaloDigits) zaloHref = `https://zalo.me/${zaloDigits}`;
  else if (phone) zaloHref = `https://zalo.me/${phone.replace(/\D/g, "")}`;

  return {
    enabled: c.enabled,
    phone,
    hotlineHref: phone ? `tel:${phone}` : "#dang-ky",
    hasHotline: Boolean(phone),
    zaloHref: zaloHref || "#dang-ky",
    hasZalo: Boolean(zaloHref),
    messengerHref: safeExternalHref((c.messenger || "").trim()),
  };
}
