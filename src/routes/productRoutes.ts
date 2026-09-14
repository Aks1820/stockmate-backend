import { Router, type Response } from "express";
import { isValidObjectId } from "mongoose";
import { requireUser } from "../middleware/auth.js";
import Product from "../models/Product.js";

const productRoutes = Router();
productRoutes.use(requireUser);

productRoutes.get("/", async (_req, res) => {
  try {
    const products = await Product.find({ userId: res.locals.userId }).sort({
      createdAt: -1,
    });
    res.json(products);
  } catch {
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

productRoutes.post("/", async (req, res) => {
  const payload = req.body;

  if (!isValidProductPayload(payload)) {
    res.status(400).json({
      message:
        "Product name, SKU, category, price, stock, and lowStockThreshold are required",
    });
    return;
  }

  try {
    const product = await Product.create({
      ...payload,
      userId: res.locals.userId,
    });
    res.status(201).json(product);
  } catch (error) {
    sendProductError(res, error, "create");
  }
});

productRoutes.put("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  const updates = { ...(req.body ?? {}) };
  delete updates.userId;

  if (!isValidProductUpdate(updates)) {
    res.status(400).json({ message: "Invalid product update payload" });
    return;
  }

  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, userId: res.locals.userId },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.json(product);
  } catch (error) {
    sendProductError(res, error, "update");
  }
});

productRoutes.delete("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      userId: res.locals.userId,
    });
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.status(204).send();
  } catch {
    res.status(500).json({ message: "Failed to delete product" });
  }
});

productRoutes.get("/barcode/:barcode", async (req, res) => {
  console.log("LOOKING FOR BARCODE:", req.params.barcode);
  console.log("USER:", res.locals.userId);
  
  try {
    const product = await Product.findOne({
      barcode: req.params.barcode,
      userId: res.locals.userId,
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({
      message: "Failed to find product",
    });
  }
});

function sendProductError(res: Response, error: unknown, action: string) {
  if (isDuplicateKeyError(error)) {
    const keyPattern = error.keyPattern;

    if (keyPattern?.barcode) {
      res.status(409).json({ message: "Barcode already exists for this user" });
      return;
    }

    if (keyPattern?.sku) {
      res.status(409).json({ message: "SKU already exists for this user" });
      return;
    }

    res.status(409).json({
      message: "A product with these details already exists",
    });
    return;
  }

  if (isValidationError(error)) {
    res.status(400).json({ message: error.message });
    return;
  }

  res.status(500).json({ message: `Failed to ${action} product` });
}

const isDuplicateKeyError = (
  error: unknown,
): error is {
  code: number;
  keyPattern?: Record<string, number>;
} =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const isValidationError = (
  error: unknown,
): error is { name: string; message: string } =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  "message" in error &&
  error.name === "ValidationError" &&
  typeof error.message === "string";

const isValidProductPayload = (
  payload: unknown,
): payload is {
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
} => {
  if (typeof payload !== "object" || payload === null) return false;

  const { name, sku, barcode, category, price, stock, lowStockThreshold } =
    payload as Record<string, unknown>;

  return (
    typeof name === "string" &&
    name.trim().length > 0 &&
    typeof sku === "string" &&
    sku.trim().length > 0 &&
    (barcode === undefined || typeof barcode === "string") &&
    typeof category === "string" &&
    category.trim().length > 0 &&
    typeof price === "number" &&
    Number.isFinite(price) &&
    price >= 0 &&
    typeof stock === "number" &&
    Number.isFinite(stock) &&
    stock >= 0 &&
    typeof lowStockThreshold === "number" &&
    Number.isFinite(lowStockThreshold) &&
    lowStockThreshold >= 0
  );
};

const isValidProductUpdate = (
  payload: unknown,
): payload is Partial<{
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
}> => {
  if (typeof payload !== "object" || payload === null) return false;

  const values = payload as Record<string, unknown>;

  for (const [key, value] of Object.entries(values)) {
    if (
      key === "name" &&
      (typeof value !== "string" || value.trim().length === 0)
    )
      return false;
    if (
      key === "sku" &&
      (typeof value !== "string" || value.trim().length === 0)
    )
      return false;
    if (key === "barcode" && typeof value !== "string") {
      return false;
    }
    if (
      key === "category" &&
      (typeof value !== "string" || value.trim().length === 0)
    )
      return false;
    if (
      (key === "price" || key === "stock" || key === "lowStockThreshold") &&
      (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    )
      return false;
  }

  return true;
};

export default productRoutes;
