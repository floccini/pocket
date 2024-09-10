import z from 'zod';

const envSchema = z.object({
  DB_URI: z.string().url(),
});

export const env = envSchema.parse(process.env);
