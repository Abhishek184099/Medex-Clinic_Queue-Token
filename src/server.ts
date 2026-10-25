import "dotenv/config"
import { createApp } from "./app";

async function main() {


  const app = createApp({ allowOverride : process.env.NODE_ENV !== "production" });

  app.listen(process.env.PORT, () => {
    console.log(`API listening on http://localhost:${process.env.PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});