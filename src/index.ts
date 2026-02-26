import app from "./app";
import prisma from "./prismaClient";

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   POST /identify - Identity reconciliation endpoint`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

main();
