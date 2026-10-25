import * as z from 'zod';
import { dbDetailSchema } from '@/implementations/kb08/types/schemas/v2alpha/db';

export const pathParams = z.object({});

export const response = z.object({
  data: z.array(dbDetailSchema)
});
