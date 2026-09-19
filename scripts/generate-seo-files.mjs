import { writeFile } from "node:fs/promises";

function normalizeSiteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "https://tvq10.vercel.app";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

const siteUrl = normalizeSiteUrl(
  process.env.VITE_SITE_URL || "https://tvq10.vercel.app",
);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

const robots = `User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

await writeFile("public/sitemap.xml", sitemap, "utf8");
await writeFile("public/robots.txt", robots, "utf8");
console.log(`Generated sitemap and robots for ${siteUrl}`);
