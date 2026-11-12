export type SiteLink = {
  label: string;
  href: string;
};

export type SiteMetadata = {
  title: string;
  description: string;
  author: string;
  canonicalUrl?: string;
  socialImage?: string;
  socialTitle?: string;
  socialDescription?: string;
};

export type BlogContent = {
  /** Navigation label and page heading. */
  title: string;
  path: string;
  /** Shown under the heading on the blog's index and used as its metadata. */
  description: string;
};

export type SiteContent = {
  metadata: SiteMetadata;
  blogs: {
    tech: BlogContent;
    media: BlogContent;
  };
  /** The RSS feed that combines both blogs. */
  feed: {
    title: string;
    description: string;
  };
  navigation: {
    label: string;
    links: readonly SiteLink[];
  };
  introduction: {
    name: string;
    role: string;
    summary: string;
    asciiArt?: string;
    links?: readonly SiteLink[];
  };
  about: readonly string[];
  contact: {
    prompt: string;
    heading: string;
    body: string;
    email: string;
    links?: readonly SiteLink[];
  };
  footer: {
    text: string;
    linkLabel: string;
  };
};

/**
 * Site presentation content; shared professional data lives in profile.yaml and projects/.
 */
export const site = {
  metadata: {
    title: "Reed Pennock — Software Developer",
    description:
      "Reed Pennock is a computer science student and software developer building reliable data, systems, and AI-assisted tools.",
    author: "Reed Pennock",
    canonicalUrl: "https://reedpen.site/",
    socialTitle: "Reed Pennock — Software Developer",
    socialDescription:
      "Computer science student and software developer in Provo, Utah.",
  },
  blogs: {
    tech: {
      title: "tech",
      path: "~/tech",
      description: "Notes on software, systems, and the tools I build and use.",
    },
    media: {
      title: "media",
      path: "~/media",
      description: "Thoughts on the books I read and the movies I watch.",
    },
  },
  feed: {
    title: "Reed Pennock",
    description: "Posts from Reed Pennock's tech and media blogs.",
  },
  navigation: {
    label: "~/reedpen",
    links: [
      { label: "about", href: "/#about" },
      { label: "experience", href: "/#experience" },
      { label: "projects", href: "/#projects" },
      { label: "education", href: "/#education" },
      { label: "skills", href: "/#stack" },
      { label: "guestbook", href: "/#guestbook" },
      { label: "contact", href: "/#contact" },
    ],
  },
  introduction: {
    name: "Reed Pennock",
    role: "computer science student & software developer",
    summary:
      "I build reliable software for scientific computing, data pipelines, and intelligent developer workflows.",
    asciiArt: "",
    links: [
      { label: "github", href: "https://github.com/reedpen" },
      { label: "linkedin", href: "https://www.linkedin.com/in/reed-pennock" },
      { label: "resume", href: "/resume.pdf" },
      { label: "email", href: "mailto:reederpen@gmail.com" },
    ],
  },
  about: [
    "I am a B.S. Computer Science student at Brigham Young University in Provo, Utah, graduating in April 2028. I work across scientific software, compilers, computer vision, and web applications.",
    "At OpenTeams, I work on statistical computing, compiler correctness, and developer workflows. I also build neuroscience data pipelines at BYU and lead Linux and open-source workshops for the BYU Linux Association.",
  ],
  contact: {
    prompt: "Get in touch",
    heading: "Let's build something useful.",
    body: "For software, research, or open-source collaboration, reach out by email or find me on GitHub and LinkedIn.",
    email: "reederpen@gmail.com",
    links: [
      { label: "github", href: "https://github.com/reedpen" },
      { label: "linkedin", href: "https://www.linkedin.com/in/reed-pennock" },
    ],
  },
  footer: {
    text: "© 2026 Reed Pennock",
    linkLabel: "Get in touch",
  },
} satisfies SiteContent;
