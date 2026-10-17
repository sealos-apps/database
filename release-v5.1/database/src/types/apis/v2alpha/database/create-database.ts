import { z } from 'zod';
import { dbEditSchema, dbTypeSchema } from '@/types/schemas/v2alpha/db';

// Accept main clients' MySQL name without changing release's internal engine names.
export const body = dbEditSchema.extend({
  type: z.enum([...dbTypeSchema.options, 'mysql'])
});
