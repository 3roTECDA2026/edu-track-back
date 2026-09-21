// If the project already has a shared PrismaClient instance, use that one instead.
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
