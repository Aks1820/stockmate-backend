import "dotenv/config";
import app from "./src/app.js";
import connectDB from "./src/db/db.js";

const PORT = process.env.PORT || 5000;

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;

if (!clerkSecretKey?.match(/^sk_(test|live)_/) || !clerkPublishableKey?.match(/^pk_(test|live)_/)) {
  throw new Error(
    "Invalid Clerk keys. Set CLERK_PUBLISHABLE_KEY to pk_test_/pk_live_ and CLERK_SECRET_KEY to the matching sk_test_/sk_live_ key from the same Clerk instance.",
  );
}

const startServer = async () => {
  await connectDB();

  app.listen(PORT);
};

startServer();