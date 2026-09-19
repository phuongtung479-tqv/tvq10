import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import heroImg from "@/assets/hero-student.webp";
import expert1 from "@/assets/expert-1.webp";
import expert2 from "@/assets/expert-2.webp";
import expert3 from "@/assets/expert-3.webp";
import { LeadForm, MAJORS } from "@/components/LeadForm";
import { Reveal } from "@/components/Reveal";
import { ScarcityBar } from "@/components/ScarcityBar";
import { RecentLeadPopup } from "@/components/RecentLeadPopup";
import { ExitIntentPopup } from "@/components/ExitIntentPopup";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { StickyMobileCTA } from "@/components/StickyMobileCTA";
import { FloatingContact } from "@/components/FloatingContact";
import { useSiteConfig } from "@/lib/use-site-config";
import { getVariant } from "@/lib/ab";
import { contactLinks } from "@/lib/contact-links";
import { FooterStats } from "@/components/FooterStats";
import { SiteMenu } from "@/components/SiteMenu";
import { ContentSection } from "@/components/ContentSection";
import { initBehavior, markFaqClick } from "@/lib/behavior";
import visaImg from "@/assets/gallery-visa.webp";
import campusImg from "@/assets/gallery-campus.webp";
import dormRoomImg from "@/assets/gallery-dorm-room.webp";
import airportImg from "@/assets/gallery-airport.webp";
import { Toaster } from "@/components/ui/sonner";
import { FOOTER } from "@/lib/config";
import { GraduationCap, Menu, X } from "lucide-react";

const TITLE = "Du Học Nghề Trung Quốc 0Đ | Vừa Học Vừa Làm Lương 15-30 Triệu";
const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://tvq4.vercel.app")
  .trim()
  .replace(/\/$/, "");
const DESC =
  "Du học nghề Trung Quốc học phí 0Đ: học 20% lý thuyết - 80% thực hành, lương cứng 15-30 triệu/tháng, bằng Cao đẳng chính quy quốc tế. Đăng ký nhận lộ trình miễn phí.";

const FAQS = [
  {
    slug: "hoc_phi",
    q: "Du học nghề Trung Quốc học phí 0Đ có thật không?",
    a: "Có. Học phí được doanh nghiệp Trung Quốc tài trợ theo chương trình liên kết đào tạo nhân lực. Học viên chỉ cần chuẩn bị chi phí hồ sơ, vé máy bay và sinh hoạt ban đầu; phần này được tư vấn minh bạch trước khi đăng ký.",
  },
  {
    slug: "tieng_trung",
    q: "Điều kiện tham gia gồm những gì?",
    a: "Tốt nghiệp THPT (hoặc tương đương), độ tuổi 18-28, sức khỏe tốt. Không cần chứng minh tài chính và không yêu cầu biết tiếng Hán trước — học viên được đào tạo tiếng Hán nền tảng trước khi bay.",
  },
  {
    slug: "luong_thuc_tap",
    q: "Vừa học vừa làm thì lương bao nhiêu và có đủ sống không?",
    a: "Thu nhập thực tập tại doanh nghiệp đối tác thường 15-30 triệu đồng/tháng tùy ngành và ca làm. Mức này đủ trang trải sinh hoạt, ký túc xá và còn dư gửi về gia đình.",
  },
  {
    slug: "bang_cap",
    q: "Bằng tốt nghiệp có được công nhận không?",
    a: "Học viên nhận bằng Cao đẳng chính quy của trường tại Trung Quốc, được công nhận quốc tế, có thể ở lại làm việc, học liên thông lên Đại học hoặc về Việt Nam làm cho doanh nghiệp FDI.",
  },
  {
    slug: "thoi_gian",
    q: "Thời gian nhập học và quy trình mất bao lâu?",
    a: "Có hai kỳ nhập học mỗi năm: tháng 3 và tháng 9. Từ lúc đăng ký tới khi bay thường 3-5 tháng, gồm xét hồ sơ, học tiếng Hán và làm thủ tục visa.",
  },
  {
    slug: "nganh_hoc",
    q: "Ngành nào đang cần nhiều nhân lực nhất?",
    a: "Công nghệ ô tô điện, công nghệ drone (UAV), IoT và logistics là các ngành tuyển nhiều nhất, đồng thời có mức lương thực tập cao nhất trong 8 ngành của chương trình.",
  },
];

const FAQ_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [{ type: "application/ld+json", children: FAQ_JSONLD }],
  }),
  component: Landing,
});

const BENEFITS = [
  {
    stat: "0Đ",
    title: "Học phí bằng 0",
    text: "Doanh nghiệp Trung Quốc tài trợ toàn bộ học phí theo chương trình liên kết đào tạo nhân lực.",
  },
  {
    stat: "80%",
    title: "80% thực hành",
    text: "Chỉ 20% lý thuyết. Bạn làm việc trực tiếp trên dây chuyền, máy móc và công nghệ mới nhất.",
  },
  {
    stat: "15-30tr",
    title: "Lương cứng mỗi tháng",
    text: "Vừa học vừa làm, thu nhập 15-30 triệu/tháng, đủ chi phí sinh hoạt và gửi về gia đình.",
  },
  {
    stat: "Bằng",
    title: "Cao đẳng chính quy quốc tế",
    text: "Bằng Cao đẳng chính quy được công nhận quốc tế, mở đường ở lại làm việc hoặc học tiếp.",
  },
];

const MAJOR_ICONS = ["🚗", "🛸", "🛒", "🚚", "🔌", "📡", "⚙️", "🀄"];

const MAJOR_FUTURES = [
  "Đón đầu xu hướng điện hóa giao thông, pin thế hệ mới và hệ sinh thái xe thông minh.",
  "Phát triển cùng nhu cầu UAV trong nông nghiệp, vận chuyển, khảo sát và cứu hộ.",
  "Mở rộng theo thương mại xuyên biên giới, bán hàng đa kênh và vận hành bằng dữ liệu.",
  "Giữ vai trò cốt lõi khi chuỗi cung ứng khu vực ngày càng tự động hóa và kết nối sâu.",
  "Là nền tảng cho thiết bị thông minh, năng lượng sạch, robot và sản xuất công nghệ cao.",
  "Kết nối nhà máy, đô thị và thiết bị thông minh trong nền kinh tế số tương lai.",
  "Thúc đẩy nhà máy thông minh, robot cộng tác và dây chuyền sản xuất ít phụ thuộc lao động tay chân.",
  "Tạo lợi thế trong thương mại, dịch vụ và hợp tác doanh nghiệp Việt Nam – Trung Quốc.",
];

const PAINS = [
  "Làm công nhân 10-12 tiếng/ngày, lương không tăng, tay nghề không lên.",
  "Không có bằng cấp quốc tế nên mãi không thoát khỏi vị trí lao động phổ thông.",
  "Muốn đi nước ngoài nhưng sợ chi phí hàng trăm triệu và rủi ro môi giới.",
];

const STEPS = [
  {
    n: "01",
    t: "Đăng ký & tư vấn 1:1",
    d: "Điền form, chuyên viên gọi lại trong 30 phút, gửi lộ trình chi tiết.",
  },
  {
    n: "02",
    t: "Chọn ngành & xét hồ sơ",
    d: "Chọn 1 trong 8 ngành hot, hoàn thiện hồ sơ theo hướng dẫn từng bước.",
  },
  {
    n: "03",
    t: "Học tiếng Hán & định hướng",
    d: "Đào tạo tiếng Hán nền tảng và kỹ năng trước khi bay.",
  },
  {
    n: "04",
    t: "Nhập học & bắt đầu kiếm tiền",
    d: "Sang trường đối tác, học nghề và làm việc có lương ngay từ kỳ đầu.",
  },
];

const GALLERY = [
  {
    img: visaImg,
    caption: "Visa du học sinh đã được cấp cho học viên khóa gần nhất",
  },
  {
    img: campusImg,
    caption: "Khuôn viên trường Cao đẳng nghề đối tác tại Trung Quốc",
  },
  {
    img: dormRoomImg,
    caption: "Phòng ký túc xá trong trường — miễn 100% phí ở",
  },
  { img: airportImg, caption: "Học viên lên đ��ờng nhập học kỳ tháng 9" },
];

const EXPERTS = [
  {
    img: expert1,
    name: "Ths. Nguyễn Thu Hương",
    role: "Chuyên gia định hướng ngành học",
    bio: "Tập trung đánh giá năng lực, sở thích và mục tiêu dài hạn để giúp học viên chọn ngành phù hợp.",
    experience:
      "Kinh nghiệm tư vấn lộ trình học nghề quốc tế và định hướng nghề nghiệp sau tốt nghiệp.",
  },
  {
    img: expert2,
    name: "Ông Lê Quang Vinh",
    role: "Chuyên gia hồ sơ & tuyển sinh",
    bio: "Đồng hành cùng học viên từ bước rà soát điều kiện đến hoàn thiện hồ sơ nhập học và visa.",
    experience:
      "Kinh nghiệm xử lý hồ sơ tuyển sinh, thủ tục du học và chuẩn bị trước khi xuất cảnh.",
  },
  {
    img: expert3,
    name: "Cô Phạm Minh Anh",
    role: "Chuyên gia đồng hành học viên",
    bio: "Hỗ trợ học viên chuẩn bị ngôn ngữ, kỹ năng thích nghi và kế hoạch học tập tại Trung Quốc.",
    experience:
      "Kinh nghiệm đào tạo kỹ năng tiền du học và hỗ trợ học viên trong quá trình hòa nhập.",
  },
];

const STATS = [
  { v: "100%", l: "Học viên có việc làm khi thực tập" },
  { v: "15-30tr", l: "Thu nhập mỗi tháng khi vừa học vừa làm" },
  { v: "8", l: "Ngành công nghệ đang khát nhân lực" },
  { v: "0Đ", l: "Học phí trong toàn bộ khóa học" },
];

const TESTIMONIALS = [
  {
    name: "Nguyễn Văn Hùng",
    meta: "Ngành Ô tô điện · Quảng Châu · khóa tháng 9",
    text: "Trước em làm xưởng gỗ 7 triệu/tháng. Sang đây vừa học vừa làm được hơn 20 triệu, tháng nào cũng gửi về nhà 10 triệu. Tay nghề lên hẳn vì được làm trên xe thật.",
  },
  {
    name: "Trần Thị Ngọc",
    meta: "Ngành Thương mại điện tử · Nghĩa Ô",
    text: "Em không biết tiếng Hán, được học nền tảng trước khi bay nên sang không bị choáng. Giờ em phụ trách livestream cho một shop, thu nhập ổn định.",
  },
  {
    name: "Lê Đình Phúc",
    meta: "Ngành Drone (UAV) · Thâm Quyến",
    text: "Nhà em không đủ tiền cho đi du học tự túc. Chương trình 0Đ giúp em học ngành công nghệ mà chi phí ban đầu rất nhẹ. Ra trường có bằng Cao đẳng chính quy.",
  },
];

function Landing() {
  const { config } = useSiteConfig();
  const content = config.landing;
  const variant = getVariant(config.abTest.enabled, config.abTest.split);
  const experimentHeadline =
    variant === "B"
      ? config.abTest.variantBHeadline
      : config.abTest.variantAHeadline;
  const experimentCta =
    variant === "B" ? config.abTest.variantBCta : config.abTest.variantACta;
  const section = (id: string) =>
    content.sectionsArray.find((item) => item.id === id);
  const sectionStyle = (id: string) => {
    const idx = content.sectionsArray.findIndex((item) => item.id === id);
    return {
      order: (idx + 1) * 10,
      display: section(id)?.enabled === false ? "none" : undefined,
    };
  };
  const gallerySlides = GALLERY.map((slide, index) => ({
    ...slide,
    img: content.galleryImageUrls[index] || slide.img,
    caption: content.galleryCaptions[index] || slide.caption,
  }));
  const sectionIndexMap = new Map(
    content.sectionsArray.map((item, i) => [item.id, i]),
  );
  const extraGallerySliders = content.gallerySliders
    .filter((slider) => slider.enabled)
    .map((slider, idx) => {
      const anchorId = slider.insertAfter || "gallery";
      const anchorIdx =
        sectionIndexMap.get(anchorId) ?? sectionIndexMap.get("gallery") ?? 6;
      return {
        ...slider,
        order: (anchorIdx + 1) * 10 + idx + 1,
        slides: slider.imageUrls
          .map((img, i) => ({ img, caption: slider.captions[i] || "" }))
          .filter((s) => s.img),
      };
    })
    .filter((slider) => slider.slides.length > 0);
  const faqs = content.faqs.map((faq) => ({
    slug: faq.slug,
    q: faq.question,
    a: faq.answer,
  }));
  const customSections = content.sectionsArray.filter(
    (item) => item.type === "custom" && item.enabled,
  );
  const offerSection = content.sectionsArray.find(
    (item) => item.type === "offer" && item.enabled,
  );
  const links = contactLinks(config);
  const menuPages = config.pages
    .filter((page) => page.enabled && page.showInMenu)
    .sort((a, b) => a.menuOrder - b.menuOrder);
  const secondaryPageSectionIds = new Set(
    config.pages
      .filter((page) => page.id !== "home")
      .flatMap((page) => page.sectionIds || []),
  );
  const homeCustomSections = customSections.filter(
    (section) => !secondaryPageSectionIds.has(section.id),
  );
  const heroSlides = useMemo(() => {
    const configured =
      content.heroMediaMode === "slider"
        ? content.heroSliderImages.filter(Boolean)
        : [content.heroImageUrl].filter(Boolean);
    return configured.length > 0
      ? configured
      : [content.heroImageUrl || heroImg];
  }, [content.heroImageUrl, content.heroMediaMode, content.heroSliderImages]);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(
    () =>
      initBehavior({
        storageMode: config.admin.storageMode,
        supabaseUrl: config.admin.supabaseUrl,
        supabaseAnonKey: config.admin.supabaseAnonKey,
        variant: getVariant(config.abTest.enabled, config.abTest.split),
      }),
    [
      config.admin.storageMode,
      config.admin.supabaseAnonKey,
      config.admin.supabaseUrl,
      config.abTest.enabled,
      config.abTest.split,
    ],
  );

  useEffect(() => {
    setHeroSlideIndex(0);
  }, [content.heroMediaMode, heroSlides.length]);

  useEffect(() => {
    if (content.heroMediaMode !== "slider" || heroSlides.length <= 1) return;
    const timer = window.setInterval(
      () => setHeroSlideIndex((current) => (current + 1) % heroSlides.length),
      Math.max(2500, content.heroSliderIntervalMs || 4500),
    );
    return () => window.clearInterval(timer);
  }, [content.heroMediaMode, content.heroSliderIntervalMs, heroSlides.length]);

  return (
    <div id="top" className="flex min-h-screen flex-col bg-background">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header
        style={{ order: 0 }}
        className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <SiteMenu
            pages={menuPages.map((page) => ({
              id: page.id,
              title: page.title,
              path: page.path,
            }))}
            brandName={content.brandName}
            logoUrl={content.logoUrl}
            showLogo={content.showLogo}
            ctaLabel={content.heroCtaLabel}
            ctaHref="#dang-ky"
            activePageId="home"
          />
          <a
            href="#top"
            className="flex min-w-0 flex-1 items-center gap-2.5"
            aria-label={content.brandName}
          >
            {content.showLogo &&
              (content.logoUrl ? (
                <img
                  src={content.logoUrl}
                  alt="Logo"
                  className="h-9 w-9 shrink-0 rounded-lg object-contain ring-1 ring-primary/20 sm:h-11 sm:w-11 sm:rounded-xl"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-cta)] sm:h-11 sm:w-11 sm:rounded-xl">
                  <GraduationCap
                    className="h-5 w-5 sm:h-6 sm:w-6"
                    aria-hidden="true"
                  />
                </span>
              ))}
            <span className="min-w-0 max-w-[15rem] truncate text-xs font-extrabold leading-tight sm:max-w-[22rem] sm:text-sm">
              {content.brandName}
            </span>
          </a>
          <a
            href="#dang-ky"
            className="hidden shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-cta)] transition hover:-translate-y-0.5 hover:brightness-110 sm:inline-block"
          >
            {content.heroCtaLabel}
          </a>
        </div>
        {mobileMenuOpen && (
          <nav
            className="border-t border-border/60 bg-background px-4 py-2 lg:hidden"
            aria-label="Menu chính (di động)"
          >
            <ul className="flex flex-col">
              {menuPages.map((page) => (
                <li key={page.id}>
                  {page.path ? (
                    <Link
                      to="/$"
                      params={{ _splat: page.path }}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                    >
                      {page.title}
                    </Link>
                  ) : (
                    <Link
                      to="/"
                      hash="top"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                    >
                      {page.title}
                    </Link>
                  )}
                </li>
              ))}
              <li>
                <a
                  href="#dang-ky"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-2 block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-bold text-primary-foreground sm:hidden"
                >
                  {content.heroCtaLabel}
                </a>
              </li>
            </ul>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section
        style={sectionStyle("hero")}
        className="surface-panel relative overflow-hidden"
      >
        <div className="absolute inset-0">
          {heroSlides.map((slide, index) => (
            <img
              key={`${slide}-${index}`}
              src={slide || heroImg}
              alt="Học viên Việt Nam thực hành lắp ráp ô tô điện tại trung tâm đào tạo nghề Trung Quốc"
              width={1600}
              height={1104}
              fetchPriority={index === 0 ? "high" : undefined}
              decoding="async"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                content.heroMediaMode === "slider"
                  ? index === heroSlideIndex
                    ? "opacity-30"
                    : "opacity-0"
                  : "opacity-25"
              }`}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-surface/68" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pb-14 pt-7 sm:gap-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div className="text-surface-foreground">
            <span className="inline-flex max-w-full items-center rounded-full bg-gold px-3 py-1.5 text-xs font-extrabold leading-relaxed tracking-wide text-gold-foreground">
              {content.heroEyebrow}
            </span>
            <h1 className="mt-6 text-3xl font-black leading-[1.12] sm:text-4xl lg:text-[3.25rem]">
              {experimentHeadline || content.heroTitle}{" "}
              <span className="text-hero-gradient">
                {content.heroHighlight}
              </span>
            </h1>
            <p className="mt-5 max-w-xl whitespace-pre-line text-base leading-relaxed text-surface-foreground/85 sm:text-lg">
              {content.heroDescription}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#dang-ky"
                className="cta-pulse rounded-xl bg-primary px-7 py-4 text-center text-base font-extrabold uppercase tracking-wide text-primary-foreground sm:text-lg"
              >
                {experimentCta || content.heroCtaLabel}
              </a>
              <span className="text-center text-sm text-surface-foreground/70 sm:text-left">
                Chỉ còn{" "}
                <strong className="text-gold">
                  {config.countdown.slotsLeft}
                </strong>{" "}
                {config.countdown.headline}
              </span>
            </div>
            <ul className="mt-9 grid gap-2.5 text-sm text-surface-foreground/90 sm:grid-cols-2">
              {content.heroTrustItems.map((item) => (
                <li
                  key={item}
                  className="flex min-w-0 items-start gap-2 rounded-lg bg-white/5 px-3 py-2 leading-relaxed"
                >
                  <span className="mt-0.5 shrink-0 text-gold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3 lg:pl-4">
            <ScarcityBar tone="dark" />
            <LeadForm />
          </div>
        </div>
      </section>

      {config.trafficStats.enabled &&
        config.trafficStats.position === "afterHero" && (
          <section
            style={{ order: 15 }}
            className="border-b border-border/40 bg-muted/20 py-3"
          >
            <div className="mx-auto max-w-6xl px-4">
              <FooterStats
                title={config.trafficStats.title}
                helperText={config.trafficStats.helperText}
              />
            </div>
          </section>
        )}

      {/* Stats */}
      <section
        style={sectionStyle("stats")}
        className="border-b border-border bg-muted/50 py-10"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 lg:grid-cols-4">
          {content.stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 80}>
              <div className="glass-card h-full rounded-2xl p-5 text-center">
                <p className="text-2xl font-black text-primary sm:text-3xl">
                  {s.value}
                </p>
                <p className="mt-2 text-xs font-semibold leading-snug text-muted-foreground sm:text-sm">
                  {s.label}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pain */}
      <section
        style={sectionStyle("pains")}
        className="mx-auto max-w-6xl px-4 py-16 sm:py-20"
      >
        <h2 className="max-w-2xl text-2xl font-extrabold sm:text-3xl lg:text-4xl">
          {content.painHeading}
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {content.pains.map((p, i) => (
            <Reveal key={p} delay={i * 100}>
              <div className="h-full rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed transition hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
                <span className="text-lg font-black text-primary">!</span>
                <p className="mt-2 text-card-foreground/85">{p}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section
        style={sectionStyle("benefits")}
        data-section="luong_thuc_tap"
        className="bg-muted/60 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">
            {content.benefitsHeading}
          </h2>
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {content.benefits.map((b, i) => (
              <Reveal key={b.title} delay={i * 90}>
                <div className="glass-card h-full rounded-2xl p-6 transition hover:-translate-y-1">
                  <p className="text-3xl font-black text-primary">{b.stat}</p>
                  <h3 className="mt-3 text-lg font-bold">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {b.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Majors */}
      <section
        style={sectionStyle("majors")}
        data-section="nganh_hoc"
        className="mx-auto max-w-6xl px-4 py-16 sm:py-20"
      >
        <h2 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">
          {content.majorsHeading}
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {content.majorsDescription}
        </p>
        <div className="mt-9 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {content.majorNames.map((m, i) => (
            <Reveal key={m} delay={(i % 4) * 80}>
              <div className="h-full rounded-2xl border border-border bg-card p-5 transition duration-300 hover:-translate-y-1.5 hover:border-primary hover:shadow-[var(--shadow-card)]">
                <span className="text-2xl">{content.majorIcons[i] || "•"}</span>
                <h3 className="mt-3 text-base font-bold leading-snug">{m}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {content.majorDescriptions[i] || MAJOR_FUTURES[i]}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Experts */}
      <section
        style={sectionStyle("experts")}
        className="bg-muted/50 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">
            {content.expertsHeading}
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {content.expertsDescription}
          </p>
          <div className="mt-9 grid gap-5 sm:grid-cols-3">
            {content.experts.map((e, i) => (
              <Reveal key={e.name} delay={i * 90}>
                <article className="glass-card flex h-full flex-col rounded-2xl p-6">
                  <img
                    src={content.expertImageUrls[i] || EXPERTS[i]!.img}
                    alt={`${e.name} — ${e.role}`}
                    width={640}
                    height={640}
                    loading="lazy"
                    decoding="async"
                    className="h-20 w-20 max-w-full shrink-0 rounded-full object-cover ring-2 ring-border"
                  />
                  <h3 className="mt-4 text-base font-bold leading-snug">
                    {e.name}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-primary">
                    {e.role}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-card-foreground/85">
                    {e.bio}
                  </p>
                  <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                    {e.experience}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery carousel — original visa/campus/dorm slider */}
      <section
        style={sectionStyle("gallery")}
        className="mx-auto max-w-3xl px-4 py-16 sm:py-20"
      >
        <h2 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">
          {content.galleryHeading}
        </h2>
        <p className="mt-3 text-muted-foreground">
          {content.galleryDescription}
        </p>
        <Reveal>
          <div className="mt-8">
            <PhotoCarousel slides={gallerySlides} />
          </div>
        </Reveal>
      </section>

      {/* Additional customizable gallery sliders */}
      {extraGallerySliders.map((slider, idx) => (
        <section
          key={slider.id}
          style={{ order: slider.order }}
          className="mx-auto max-w-3xl px-4 py-12 sm:py-16"
        >
          <h2 className="text-xl font-extrabold sm:text-2xl lg:text-3xl">
            {slider.heading}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {slider.description}
          </p>
          <Reveal>
            <div className="mt-6">
              <PhotoCarousel slides={slider.slides} />
            </div>
          </Reveal>
        </section>
      ))}

      {/* Testimonials */}
      <section
        style={sectionStyle("testimonials")}
        className="mx-auto max-w-6xl px-4 py-16 sm:py-20"
      >
        <h2 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">
          {content.testimonialsHeading}
        </h2>
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {content.testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <blockquote className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-1">
                <p className="text-gold" aria-hidden="true">
                  ★★★★★
                </p>
                {t.avatarUrl && (
                  <img
                    src={t.avatarUrl}
                    alt={`Ảnh đại diện ${t.name}`}
                    width={48}
                    height={48}
                    loading="lazy"
                    className="mt-3 h-12 w-12 rounded-full object-cover ring-2 ring-border"
                  />
                )}
                <p className="mt-3 flex-1 text-sm leading-relaxed text-card-foreground/90">
                  “{t.text}”
                </p>
                <footer className="mt-4 border-t border-border pt-3">
                  <p className="text-sm font-bold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.meta}</p>
                </footer>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section
        style={sectionStyle("steps")}
        className="surface-panel py-16 text-surface-foreground sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">
            {content.stepsHeading}
          </h2>
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {content.steps.map((s, i) => (
              <Reveal key={s.number} delay={i * 90}>
                <div className="glass-card-dark h-full rounded-2xl p-5">
                  <p className="text-2xl font-black text-gold">{s.number}</p>
                  <h3 className="mt-2 text-base font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-surface-foreground/75">
                    {s.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={sectionStyle("finalCta")}
        className="bg-muted/60 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-2xl font-extrabold sm:text-3xl lg:text-4xl">
            {content.finalCtaHeading}
          </h2>
          <p className="mt-3 text-center text-muted-foreground">
            {content.finalCtaDescription}
          </p>
          <div className="mt-8 space-y-3">
            <ScarcityBar />
            <LeadForm id="dang-ky-cuoi" />
          </div>
        </div>
      </section>

      {homeCustomSections.map((item) => (
        <div key={item.id} style={{ order: (item.order + 1) * 10 + 5 }}>
          <ContentSection section={item} />
        </div>
      ))}

      {/* Graduation proof — ngay trên phần ưu đãi */}
      {content.graduationImageUrls.length > 0 && (
        <section
          style={{ order: 960 }}
          className="border-y border-border bg-muted/40 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-gold px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-gold-foreground">
                <GraduationCap className="h-3.5 w-3.5" />
                {content.graduationBadge}
              </span>
              <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl lg:text-4xl">
                {content.graduationHeading}
              </h2>
              <p className="mt-4 whitespace-pre-line text-left text-sm leading-relaxed text-muted-foreground sm:text-base">
                {content.graduationDescription}
              </p>
            </div>
            <Reveal>
              <div className="mt-9 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
                {content.graduationImageUrls.map((src, i) => (
                  <div
                    key={`${src}-${i}`}
                    className="group aspect-square overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]"
                  >
                    <img
                      src={src}
                      alt={`Minh chứng lễ tốt nghiệp ${i + 1}`}
                      loading="lazy"
                      className="h-full w-full max-w-full object-cover transition duration-500 group-hover:scale-110"
                    />
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {offerSection && (
        <div style={{ order: 970 }}>
          <ContentSection section={offerSection} />
        </div>
      )}

      {/* FAQ — nằm cuối cùng, gần Footer nhất */}
      <section
        id="faq"
        style={{
          order: 980,
          display: section("faq")?.enabled === false ? "none" : undefined,
        }}
        className="mx-auto max-w-3xl px-4 py-16 sm:py-20"
      >
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl lg:text-4xl">
          {content.faqHeading}
        </h2>
        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              onToggle={(e) => {
                if ((e.currentTarget as HTMLDetailsElement).open)
                  markFaqClick(f.slug);
              }}
              className="group rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50"
            >
              <summary className="cursor-pointer break-words text-base font-bold leading-snug marker:hidden">
                <span className="mr-2 text-primary">?</span>
                {f.q}
              </summary>
              <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </p>
            </details>
          ))}
        </div>
        <div className="mt-8 text-center">
          <a
            href="#dang-ky-cuoi"
            className="inline-flex w-full max-w-md items-center justify-center rounded-xl bg-primary px-6 py-3 text-center text-sm font-extrabold text-primary-foreground sm:w-auto"
          >
            Nhận tư vấn điều kiện và lộ trình phù hợp
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{ order: 990 }}
        className="border-t border-border bg-background py-12"
      >
        {config.trafficStats.enabled &&
          config.trafficStats.position === "footer" && (
            <div className="mx-auto mb-10 max-w-6xl px-4">
              <FooterStats
                title={config.trafficStats.title}
                helperText={config.trafficStats.helperText}
              />
            </div>
          )}
        <div className="mx-auto max-w-6xl px-4 text-sm text-muted-foreground">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              {(config.footer.logoUrl || content.logoUrl) && (
                <img
                  src={config.footer.logoUrl || content.logoUrl}
                  alt={`Logo ${content.brandName}`}
                  width={180}
                  height={52}
                  loading="lazy"
                  className="mb-3 h-10 max-w-[180px] object-contain object-left"
                />
              )}
              <p className="font-bold text-foreground">{content.brandName}</p>
            </div>
            {config.footer.menuLinks.length > 0 && (
              <nav aria-label={config.footer.menuLabel} className="min-w-0">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground">
                  {config.footer.menuLabel}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {config.footer.menuLinks.map((link) => (
                    <a
                      key={`${link.label}-${link.href}`}
                      href={link.href}
                      className="font-semibold underline-offset-4 transition hover:text-primary hover:underline"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </nav>
            )}
          </div>
          {(links.hasHotline || FOOTER.email) && (
            <p className="mt-2">
              {links.hasHotline && (
                <>
                  Hotline tư vấn:{" "}
                  <a
                    className="font-semibold text-foreground"
                    href={links.hotlineHref}
                  >
                    {config.floatingContact.hotline}
                  </a>
                </>
              )}
              {links.hasHotline && FOOTER.email && " · "}
              {FOOTER.email && (
                <>
                  Email:{" "}
                  <a
                    className="font-semibold text-foreground"
                    href={`mailto:${FOOTER.email}`}
                  >
                    {FOOTER.email}
                  </a>
                </>
              )}
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed">
            {config.footer.sponsorText ||
              `Đơn vị bảo trợ chuyên môn & tuyển sinh: ${FOOTER.sponsor}${FOOTER.address ? ` — ${FOOTER.address}` : ""}${FOOTER.licenseNumber ? ` · Giấy phép hoạt động số ${FOOTER.licenseNumber}` : ""}. Chương trình liên kết đào tạo với các trường Cao đẳng nghề và doanh nghiệp tại Trung Quốc.`}
          </p>
          <p className="mt-4 text-xs">
            © {new Date().getFullYear()} Bản quyền thuộc Trung tâm.
          </p>
        </div>
      </footer>

      <RecentLeadPopup />
      <ExitIntentPopup />

      {/* Nút liên hệ nổi — đọc từ cấu hình Admin */}
      <FloatingContact />

      {/* Mobile sticky CTA (2 nút, hiện sau khi cuộn qua hero) */}
      <StickyMobileCTA />
      <div className="h-20 sm:hidden" style={{ order: 1000 }} />
    </div>
  );
}
