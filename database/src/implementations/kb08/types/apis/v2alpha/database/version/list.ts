import { versionListSchema } from '@/implementations/kb08/types/schemas/db';
import * as z from 'zod';

export const response = z.object({
  code: z.number(),
  message: z.string(),
  data: versionListSchema
});
