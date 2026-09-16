import { Router, type Response } from "express";
import { isValidObjectId } from "mongoose";
import { requireUser } from "../middleware/auth.js";
import Product from "../models/Product.js";
import StockMovement, {
  type StockMovementType,
} from "../models/StockMovement.js";

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

    if (product.stock > 0) {
      await StockMovement.create({
        productId: product._id,
        userId: res.locals.userId,
        type: "initial",
        quantity: product.stock,
        previousStock: 0,
        newStock: product.stock,
        reason: "Initial stock",
      });
    }

    res.status(201).json(product);
  } catch (error) {
    sendProductError(res, error, "create");
  }
});

productRoutes.get("/reorder", async (_req, res) => {
  try {
    const products = await Product.find({
      userId: res.locals.userId,
      $expr: {
        $lte: ["$stock", "$lowStockThreshold"],
      },
    }).sort({
      stock: 1,
      name: 1,
    });

    const reorderList = products.map((product) => ({
      _id: product._id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      suggestedReorder: Math.max(
        1,
        product.lowStockThreshold * 2 - product.stock,
      ),
    }));

    res.json(reorderList);
  } catch {
    res.status(500).json({
      message: "Failed to fetch reorder list",
    });
  }
});

productRoutes.get("/:id/movements", async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({
      message: "Product not found",
    });
    return;
  }

  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: res.locals.userId,
    });

    if (!product) {
      res.status(404).json({
        message: "Product not found",
      });
      return;
    }

    const movements = await StockMovement.find({
      productId: product._id,
      userId: res.locals.userId,
    }).sort({
      createdAt: -1,
    });

    res.json(movements);
  } catch {
    res.status(500).json({
      message: "Failed to fetch stock history",
    });
  }
});

productRoutes.post("/:id/stock", async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  const { action, quantity, type, reason } = req.body as {
    action?: unknown;
    quantity?: unknown;
    type?: unknown;
    reason?: unknown;
  };

  if (
    (action !== "add" && action !== "remove") ||
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    res.status(400).json({
      message:
        "action must be add or remove and quantity must be a positive integer",
    });
    return;
  }

  const allowedTypes = ["purchase", "adjustment", "damage", "return"] as const;

  if (
    typeof type !== "string" ||
    !allowedTypes.includes(type as (typeof allowedTypes)[number])
  ) {
    res.status(400).json({
      message: "type must be purchase, adjustment, damage, or return",
    });
    return;
  }

  try {
    const userId = res.locals.userId as string;

    const product = await Product.findOne({
      _id: req.params.id,
      userId,
    });

    if (!product) {
      res.status(404).json({
        message: "Product not found",
      });
      return;
    }

    const previousStock = product.stock;

    const newStock =
      action === "add" ? previousStock + quantity : previousStock - quantity;

    if (newStock < 0) {
      res.status(409).json({
        message: "Insufficient stock",
      });
      return;
    }

    product.stock = newStock;

    await product.save();

    const movementType = type as StockMovementType;

    const movementData = {
      productId: product._id,
      userId,
      type: movementType,
      quantity: action === "add" ? quantity : -quantity,
      previousStock,
      newStock,
      ...(typeof reason === "string" && reason.trim()
        ? { reason: reason.trim() }
        : {}),
    };

    await StockMovement.create(movementData);

    res.json(product);
  } catch {
    res.status(500).json({
      message: "Failed to update stock",
    });
  }
});

productRoutes.get("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: res.locals.userId,
    });

    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    res.json(product);
  } catch {
    res.status(500).json({ message: "Failed to fetch product" });
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
    res.status(400).json({
      message: "Invalid product update payload",
    });
    return;
  }

  try {
    const product = await Product.findOne({
      _id: req.params.id,
      userId: res.locals.userId,
    });

    if (!product) {
      res.status(404).json({
        message: "Product not found",
      });
      return;
    }

    const previousStock = product.stock;

    Object.assign(product, updates);

    await product.save();

    if (typeof updates.stock === "number") {
      const newStock = product.stock;

      if (newStock !== previousStock) {
        await StockMovement.create({
          productId: product._id,
          userId: res.locals.userId,
          type: "adjustment",
          quantity: newStock - previousStock,
          previousStock,
          newStock,
          reason: "Manual stock adjustment",
        });
      }
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
  costPrice: number;
  stock: number;
  lowStockThreshold: number;
} => {
  if (typeof payload !== "object" || payload === null) return false;

  const {
    name,
    sku,
    barcode,
    category,
    price,
    costPrice,
    stock,
    lowStockThreshold,
  } = payload as Record<string, unknown>;

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
    typeof costPrice === "number" &&
    Number.isFinite(costPrice) &&
    costPrice >= 0 &&
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
  costPrice: number;
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
      (key === "price" ||
        key === "costPrice" ||
        key === "stock" ||
        key === "lowStockThreshold") &&
      (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    )
      return false;
  }

  return true;
};

export default productRoutes;
