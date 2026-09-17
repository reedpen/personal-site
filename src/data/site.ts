export type SiteLink = {
  label: string;
  href: string;
};

export type WorkEntry = {
  title: string;
  date?: string;
  description: string;
  organization?: string;
  technologies?: string;
  highlights?: readonly string[];
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

export type SiteMetadata = {
  title: string;
  description: string;
  author: string;
  canonicalUrl?: string;
  socialImage?: string;
  socialTitle?: string;
  socialDescription?: string;
};

export type SiteContent = {
  metadata: SiteMetadata;
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
  experience: readonly WorkEntry[];
  projects: readonly WorkEntry[];
  education: readonly EducationEntry[];
  stack: readonly StackCategory[];
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
 * This module is the single source of truth for all public site content.
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
  navigation: {
    label: "~/reedpen",
    links: [
      { label: "about", href: "#about" },
      { label: "experience", href: "#experience" },
      { label: "projects", href: "#projects" },
      { label: "education", href: "#education" },
      { label: "skills", href: "#stack" },
      { label: "contact", href: "#contact" },
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
      { label: "email", href: "mailto:reederpen@gmail.com" },
    ],
  },
  about: [
    "I am a B.S. Computer Science student at Brigham Young University in Provo, Utah, graduating in April 2028. I work across scientific software, compilers, computer vision, and web applications.",
    "My recent work includes Python pipelines for calcium-imaging and EEG data, correctness and testing infrastructure for a Python-to-C compiler, and systems that turn real-world data into useful tools.",
  ],
  experience: [
    {
      title: "Product Intern",
      organization: "OpenTeams",
      date: "May 2026 — present",
      status: "current",
      description:
        "Developing PostPython, a Python-to-C ahead-of-time compiler, with a focus on code generation, numeric-type correctness, and useful unsupported-feature diagnostics.",
      highlights: [
        "Built accuracy, edge-case, and mutation-testing infrastructure for 27 statistical kernels; cross-validated Python, native shared-library, and NumPy ufunc results against SciPy and NumPy.",
        "Applied agent orchestration with Claude Code and OpenAI Codex in development workflows; wrote technical documentation and release notes and coordinated interns producing technical videos.",
      ],
    },
    {
      title: "Software Developer, Neuroscience Lab",
      organization: "Brigham Young University",
      date: "Dec. 2025 — present",
      status: "current",
      description:
        "Leading development of Python pipelines that process terabytes of calcium-imaging video and EEG/electrophysiology data for a nine-person neuroscience research team.",
      highlights: [
        "Re-architected the analysis package into extensible object-oriented components and introduced GitHub Actions CI and comprehensive end-to-end testing.",
      ],
    },
    {
      title: "Undergraduate Teaching Assistant, CS 111",
      organization: "Brigham Young University",
      date: "Aug. 2023 — Dec. 2025",
      description:
        "Mentored more than 100 students in Python, recursion, object-oriented programming, and software testing through labs, office hours, and individual code reviews.",
      highlights: [
        "Reviewed more than 200 programming projects and provided actionable feedback on correctness, algorithmic efficiency, code quality, and style.",
      ],
    },
  ],
  projects: [
    {
      title: "Gym Occupancy Analytics Pipeline",
      technologies: "Python, PyTorch, YOLO, ONNX Runtime, SQLite, Linux",
      description:
        "Built a fault-tolerant pipeline that collects, deduplicates, and stores timestamped campus gym imagery and metadata after reverse-engineering an Android camera API and anonymous OAuth flow.",
      highlights: [
        "Developed a computer-vision pipeline using YOLO, tiled inference, spatial zones, and equipment polygons; reduced mean count error from 6.0 to 1.5 people in an initial manually labeled evaluation.",
        "Deployed collection and inference on Linux with systemd recovery, stale-feed detection, atomic database snapshots, and secure Tailscale/Syncthing synchronization; optimized GTX 1070 Ti inference to run nine detection passes per image in about 0.5 seconds.",
      ],
    },
    {
      title: "Easy Grocer",
      technologies: "Next.js, TypeScript, Supabase, PostgreSQL, Tailwind CSS",
      description:
        "Built a progressive web app that generates personalized weekly meal plans from dietary, budget, calorie, and meal-pattern preferences.",
      highlights: [
        "Implemented Supabase authentication, persistent planning history, offline support, database migrations, cached product resolution, Walmart cart handoff, and automated CI and security checks.",
      ],
    },
    {
      title: "Chess Web Server",
      technologies: "Java, WebSockets, SQL",
      description:
        "Built a real-time multiplayer chess platform with concurrent game sessions, legal-move validation, authentication, and persistent game storage.",
    },
  ],
  education: [
    {
      institution: "Brigham Young University",
      credential: "B.S. in Computer Science",
      date: "Expected Apr. 2028",
      location: "Provo, UT",
    },
  ],
  stack: [
    {
      label: "languages",
      items: [
        "Python",
        "C",
        "C++",
        "Java",
        "SQL",
        "TypeScript",
        "JavaScript",
        "HTML/CSS",
      ],
    },
    {
      label: "frameworks & libraries",
      items: [
        "React",
        "Next.js",
        "FastAPI",
        "pandas",
        "NumPy",
        "SciPy",
        "Matplotlib",
        "scikit-learn",
        "pytest",
        "PyTorch",
        "ONNX Runtime",
      ],
    },
    {
      label: "tools & platforms",
      items: [
        "Linux",
        "Git",
        "GitHub Actions",
        "Docker",
        "AWS",
        "PostgreSQL",
        "Supabase",
        "Redis",
        "Celery",
        "systemd",
        "Tailscale",
      ],
    },
    {
      label: "AI-native development",
      items: [
        "Claude Code",
        "OpenAI Codex",
        "Agent orchestration",
        "AI-assisted development",
        "QA",
        "Technical documentation",
      ],
    },
    { label: "human language", items: ["Finnish"] },
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
