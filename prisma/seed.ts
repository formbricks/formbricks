import { PrismaClient, Prisma } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);
  if (process.env.ADMIN_PASSWORD) {
    const passwordHash = await hash(process.env.ADMIN_PASSWORD, 12);

    if (typeof passwordHash === "string") {
      const users: Prisma.UserCreateInput[] = [
        {
          name: "Admin",
          email: process.env.ADMIN_EMAIL,
          password: passwordHash,
        },
      ];

      for (const user of users) {
        const userRes = await prisma.user.upsert({
          where: {
            email: user.email,
          },
          update: {},
          create: user,
        });
        console.log(`Created user with id: ${userRes.id}`);
      }
      console.log(`Seeding finished.`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
