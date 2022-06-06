import { PrismaClient, Prisma } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);
  if (process.env.ADMIN_PASSWORD) {
    const passwordHash = await hash(process.env.ADMIN_PASSWORD, 12);

    if (typeof passwordHash === "string") {
      const userData: Prisma.UserCreateInput[] = [
        {
          name: "Admin",
          email: process.env.ADMIN_EMAIL,
          password: passwordHash,
        },
      ];

      for (const u of userData) {
        const user = await prisma.user.create({
          data: u,
        });
        console.log(`Created user with id: ${user.id}`);
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
