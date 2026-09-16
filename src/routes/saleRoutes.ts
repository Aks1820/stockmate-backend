import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { requireUser } from "../middleware/auth.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import StockMovement from "../models/StockMovement.js";

const saleRoutes = Router();
saleRoutes.use(requireUser);

saleRoutes.post("/", async (req, res) => {
  const { productId, quantity } = req.body as {
    productId?: unknown;
    quantity?: unknown;
  };

  if (
    typeof productId !== "string" ||
    !isValidObjectId(productId) ||
    !isPositiveInteger(quantity)
  ) {
    res
      .status(400)
      .json({
        message: "productId and a positive integer quantity are required",
      });
    return;
  }

  const userId = res.locals.userId as string;

  try {
    const product = await Product.findOne({ _id: productId, userId });

    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    const stockUpdate = await Product.updateOne(
      { _id: product._id, userId, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
    );

    if (stockUpdate.modifiedCount !== 1) {
      res.status(409).json({ message: "Insufficient stock" });
      return;
    }

    const sale = await Sale.create({
      userId,
      productId: product._id,
      productName: product.name,
      quantity,
      unitPrice: product.price,
      total: product.price * quantity,
    });

    await StockMovement.create({
      productId: product._id,
      userId,
      type: "sale",
      quantity: -quantity,
      previousStock: product.stock,
      newStock: product.stock - quantity,
      reason: "Customer sale",
    });

    res.status(201).json(sale);
  } catch (error) {
    const product = await Product.findOne({ _id: productId, userId });
    if (product && product.stock !== undefined) {
      await Product.updateOne(
        { _id: product._id, userId },
        { $inc: { stock: Number(quantity) } },
      );
    }
    res.status(500).json({ message: "Failed to create sale" });
  }
});

saleRoutes.get("/", async (_req, res) => {
  try {
    const sales = await Sale.find({ userId: res.locals.userId }).sort({
      createdAt: -1,
    });
    res.json(sales);
  } catch {
    res.status(500).json({ message: "Failed to fetch sales" });
  }
});

saleRoutes.get("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ message: "Sale not found" });
    return;
  }

  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      userId: res.locals.userId,
    });
    if (!sale) {
      res.status(404).json({ message: "Sale not found" });
      return;
    }

    res.json(sale);
  } catch {
    res.status(500).json({ message: "Failed to fetch sale" });
  }
});

saleRoutes.delete("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ message: "Sale not found" });
    return;
  }

  try {
    const sale = await Sale.findOneAndDelete({
      _id: req.params.id,
      userId: res.locals.userId,
    });
    if (!sale) {
      res.status(404).json({ message: "Sale not found" });
      return;
    }

    res.status(204).send();
  } catch {
    res.status(500).json({ message: "Failed to delete sale" });
  }
});

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

export default saleRoutes;
