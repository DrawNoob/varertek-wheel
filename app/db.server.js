import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

// 👉 іменований експорт (для `import { prisma } ...`)
export { prisma };

// 👉 дефолтний експорт (на випадок, якщо десь так імпортували)
export default prisma;
