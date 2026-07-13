export type SiteLink = {
  label: string;
  href: string;
};

export type WorkEntry = {
  title: string;
  date: string;
  description: string;
  status?: string;
  href?: string;
};

export type EducationEntry = {
  institution: string;
  credential: string;
  date: string;
  location?: string;
  highlights?: readonly string[];
};

export type StackCategory = {
  label: string;
  items: readonly string[];
};

export type SiteContent = {
  metadata: {
    title: string;
    description: string;
    author: string;
    canonicalUrl?: string;
    socialImage?: string;
  };
  navigation: {
    label: string;
    links: readonly SiteLink[];
  };
  introduction: {
    name: string;
    role: string;
    summary: string;
    asciiArt: string;
    links: readonly SiteLink[];
  };
  about: readonly string[];
  work: readonly WorkEntry[];
  education: readonly EducationEntry[];
  stack: readonly StackCategory[];
  contact: {
    heading: string;
    body: string;
    email: string;
    links: readonly SiteLink[];
  };
  footer: string;
};

/**
 * Replace the placeholder values in this file with your own content.
 * Optional values can be removed; the corresponding UI will not render.
 */
export const site = {
  metadata: {
    title: "Lorem Ipsum — Personal Site",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. A JavaScript-free personal site.",
    author: "Lorem Ipsum",
  },
  navigation: {
    label: "~/lorem",
    links: [
      { label: "about", href: "#about" },
      { label: "work", href: "#work" },
      { label: "education", href: "#education" },
      { label: "stack", href: "#stack" },
      { label: "contact", href: "#contact" },
    ],
  },
  introduction: {
    name: "Lorem Ipsum",
    role: "dolor sit amet & builder",
    summary:
      "Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    asciiArt: "",
    links: [
      { label: "github", href: "https://example.com" },
      { label: "linkedin", href: "https://example.com" },
      { label: "email", href: "mailto:hello@example.com" },
    ],
  },
  about: [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero, sed cursus ante dapibus diam.",
    "Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent mauris fusce nec tellus sed augue semper porta.",
  ],
  work: [
    {
      title: "Lorem Platform",
      date: "2026 — present",
      status: "current",
      href: "https://example.com",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed dignissim lacinia nunc curabitur tortor.",
    },
    {
      title: "Ipsum Studio",
      date: "2024 — 2026",
      href: "https://example.com",
      description:
        "Mauris massa vestibulum lacinia arcu eget nulla. Class aptent taciti sociosqu ad litora torquent per conubia nostra.",
    },
    {
      title: "Dolor Tools",
      date: "2023",
      description:
        "In consectetur, elit sed consequat fermentum, quam ipsum dignissim purus, at tincidunt sapien neque vitae lorem.",
    },
  ],
  education: [
    {
      institution: "Lorem Ipsum University",
      credential: "B.S. Dolor Sit Amet",
      date: "2022 — 2026",
      location: "Consectetur, AD",
      highlights: [
        "Praesent libero sed cursus ante dapibus diam",
        "Nulla quis sem at nibh elementum imperdiet",
      ],
    },
  ],
  stack: [
    { label: "languages", items: ["Lorem", "Ipsum", "Dolor"] },
    { label: "frameworks", items: ["Consectetur", "Adipiscing", "Elit"] },
    { label: "tools", items: ["Praesent", "Curabitur", "Tortor"] },
    { label: "platforms", items: ["Integer", "Dapibus", "Sagittis"] },
  ],
  contact: {
    heading: "Let's talk",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent libero sed cursus ante dapibus diam.",
    email: "hello@example.com",
    links: [
      { label: "github", href: "https://example.com" },
      { label: "linkedin", href: "https://example.com" },
    ],
  },
  footer: "© 2026 Lorem Ipsum",
} satisfies SiteContent;
