import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import express from "express";
import productRoutes from "./routes/productRoutes.js";
import saleRoutes from "./routes/saleRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

app.get("/", (_req, res) => {
  res.json({
    message: "StockMate API is running",
  });
});

app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);

export default app;