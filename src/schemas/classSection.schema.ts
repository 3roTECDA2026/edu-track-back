import { z } from "zod";
import { Shift } from "@prisma/client";

export const listClassSectionsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type ListClassSectionsQuery = z.infer<typeof listClassSectionsQuerySchema>;