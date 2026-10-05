import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('123456', 10);

  const user = await prisma.user.upsert({
    where: { email: 'admin@escuela.com' },
    update: {},
    create: {
      email: 'admin@escuela.com',
      passwordHash: hashedPassword,
      firstName: 'Administrador',
      lastName: 'General',
      role: Role.ADMINISTRATOR,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(' Usuario administrador creado con éxito:', user.email);
}

main()
  .catch((e) => {
    console.error('Error al crear el usuario:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });