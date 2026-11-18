require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const connection = await prisma.$queryRaw`SELECT 1 AS connected`;
  const database = await prisma.$queryRaw`SELECT DATABASE() AS databaseName`;
  const version = await prisma.$queryRaw`SELECT VERSION() AS version`;

  console.log("TiDB connection: SUCCESS");
  console.log("Database:", database[0].databaseName);
  console.log("TiDB version:", version[0].version);
  console.log("Test query:", connection[0].connected);
}

main()
  .catch((error) => {
    console.error("TiDB connection test: FAILED");
    if (error.code) console.error("Error code:", error.code);
    if (error.message) {
      console.error(error.message.replace(/mysql:\/\/\S+/gi, "mysql://[REDACTED]"));
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });