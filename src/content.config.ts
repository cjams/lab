import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const papers = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/papers' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    date: z.coerce.date(),
    abstract: z.string().optional(),
    // Link back to the companion Substack post, if there is one.
    substack: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { papers };
