/**
 * Template Registry
 * Exports all available templates and provides a getter function
 */

import { FileSystemTree } from '@webcontainer/api';
import { blankTemplate } from './blank';
import { nextjsTemplate } from './nextjs';
import { reactViteTemplate } from './react-vite';
import { landingTemplate } from './landing';
import { dashboardTemplate } from './dashboard';
import { ecommerceTemplate } from './ecommerce';

export type TemplateId = 'blank' | 'nextjs' | 'react' | 'landing' | 'dashboard' | 'ecommerce';

export interface Template {
  id: TemplateId;
  name: string;
  description: string;
  files: FileSystemTree;
  startCommand: string;
  port: number;
}

const templates: Record<TemplateId, Template> = {
  blank: {
    id: 'blank',
    name: 'Blank Project',
    description: 'Minimal HTML/CSS/JS setup',
    files: blankTemplate,
    startCommand: 'npm run dev',
    port: 3000,
  },
  nextjs: {
    id: 'nextjs',
    name: 'Next.js',
    description: 'Next.js App Router with TypeScript',
    files: nextjsTemplate,
    startCommand: 'npm run dev',
    port: 3000,
  },
  react: {
    id: 'react',
    name: 'React + Vite',
    description: 'React with Vite and TypeScript',
    files: reactViteTemplate,
    startCommand: 'npm run dev',
    port: 5173,
  },
  landing: {
    id: 'landing',
    name: 'Landing Page',
    description: 'Marketing landing page',
    files: landingTemplate,
    startCommand: 'npm run dev',
    port: 3000,
  },
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Admin dashboard layout',
    files: dashboardTemplate,
    startCommand: 'npm run dev',
    port: 3000,
  },
  ecommerce: {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'E-commerce store with cart',
    files: ecommerceTemplate,
    startCommand: 'npm run dev',
    port: 3000,
  },
};

/**
 * Get a template by ID
 * @param templateId - The template identifier
 * @returns The template object or undefined if not found
 */
export function getTemplate(templateId: string): Template | undefined {
  return templates[templateId as TemplateId];
}

/**
 * Get all available templates
 * @returns Array of all templates
 */
export function getAllTemplates(): Template[] {
  return Object.values(templates);
}

/**
 * Check if a template exists
 * @param templateId - The template identifier to check
 * @returns true if template exists
 */
export function hasTemplate(templateId: string): boolean {
  return templateId in templates;
}

export { templates };
