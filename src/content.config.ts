import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Blog collection — files live in src/content/blog and are edited via the CMS.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    author: z.string().default('NOVARA Studio'),
    cover: z.enum(['a', 'b', 'c', 'd']).default('a'),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
