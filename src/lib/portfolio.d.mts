import { z } from "astro/zod";

export type EducationRole = {
  title: string;
  organization: string;
  location?: string;
  date: string;
  bullets: string[];
};
export type Experience = EducationRole & {
  current: boolean;
  site: boolean;
  resume: boolean;
};
export type Education = {
  institution: string;
  credential: string;
  date: string;
  location?: string;
  roles?: EducationRole[];
};
export type Skill = { label: string; siteLabel?: string; items: string[] };
export type Profile = {
  name: string;
  location: string;
  email: string;
  links: { website: string; linkedin: string; github: string };
  education: Education[];
  experience: Experience[];
  skills: Skill[];
};
export type ProjectFile = {
  title: string;
  repo?: string;
  url?: string;
  site: boolean;
  resume: boolean;
  order?: number;
  technologies?: string[];
  summary?: string;
  bullets?: string[];
  autoSummary: boolean;
  allowPrivate: boolean;
};
export type GeneratedProject = {
  repo: string;
  commit: string;
  generatedAt: string;
  model: string;
  summary: string;
  bullets: string[];
  technologies: string[];
  pushedAt: string;
  private: boolean;
};
export type GeneratedFile = {
  version: 1;
  projects: Record<string, GeneratedProject>;
};
export type Project = Omit<
  ProjectFile,
  "autoSummary" | "allowPrivate" | "order" | "technologies" | "bullets"
> & {
  slug: string;
  /** Unspecified order sorts last (positive infinity). */
  order: number;
  technologies: string[];
  bullets: string[];
  updatedAt?: string;
  generated: boolean;
};
export type StackPolicy = {
  fromProjects: boolean;
  minProjects: number;
  resume: boolean;
  aliases: Record<string, string>;
  hide: string[];
  categories: Record<string, string[]>;
};
export type Portfolio = {
  profile: Profile;
  projects: Project[];
  stack: StackPolicy;
};
export const stackFileSchema: z.ZodType<StackPolicy>;
export function canonicalTechnology(stack: StackPolicy, name: string): string;
export function stackTechnologies(
  p: Portfolio,
): { name: string; projects: string[] }[];
export function siteStack(p: Portfolio): Skill[];
export function resumeStack(p: Portfolio): Skill[];
export function uncategorizedTechnologies(
  p: Portfolio,
): { name: string; projects: string[] }[];
export const profileSchema: z.ZodType<Profile>;
export const projectFileSchema: z.ZodType<ProjectFile>;
export const generatedFileSchema: z.ZodType<GeneratedFile>;
/** Root accepts a filesystem path or file URL string; defaults to the source repository root. */
export function loadPortfolio(options?: { root?: string }): Portfolio;
export function siteProjects(p: Portfolio): Project[];
export function resumeProjects(p: Portfolio): Project[];
export function siteExperience(p: Portfolio): Experience[];
export function resumeExperience(p: Portfolio): Experience[];
