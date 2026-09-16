import { Router } from "express";
import { isValidObjectId, startSession } from "mongoose";
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
    res.status(400).json({
      message:
        "productId and a positive integer quantity are required",
    });
    return;
  }

  const userId = res.locals.userId as string;
  const session = await startSession();

  try {
    await session.startTransaction();

    const product = await Product.findOne({
      _id: productId,
      userId,
    }).session(session);

    if (!product) {
      await session.abortTransaction();

      res.status(404).json({
        message: "Product not found",
      });

      return;
    }

    if (product.stock < quantity) {
      await session.abortTransaction();

      res.status(409).json({
        message: "Insufficient stock",
      });

      return;
    }

    const previousStock = product.stock;
    const newStock = previousStock - quantity;

    const unitCost = product.costPrice;
    const unitPrice = product.price;

    const totalCost = unitCost * quantity;
    const total = unitPrice * quantity;
    const profit = total - totalCost;

    /*
     * 1. Decrease stock
     */
    product.stock = newStock;

    await product.save({
      session,
    });

    /*
     * 2. Create sale
     */
    const sales = await Sale.create(
      [
        {
          userId,
          productId: product._id,
          productName: product.name,
          quantity,
          unitPrice,
          unitCost,
          total,
          totalCost,
          profit,
        },
      ],
      {
        session,
      },
    );

    const sale = sales[0];

    if (!sale) {
      throw new Error("Failed to create sale");
    }

    /*
     * 3. Create stock movement
     */
    await StockMovement.create(
      [
        {
          productId: product._id,
          userId,
          type: "sale",
          quantity: -quantity,
          previousStock,
          newStock,
          reason: "Customer sale",
        },
      ],
      {
        session,
      },
    );

    /*
     * 4. Commit everything together
     */
    await session.commitTransaction();

    res.status(201).json(sale);
  } catch (error) {
    /*
     * Roll back if anything failed.
     */
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error(
      "CREATE SALE ERROR:",
      error,
    );

    res.status(500).json({
      message: "Failed to create sale",
    });
  } finally {
    await session.endSession();
  }
});

saleRoutes.get("/", async (_req, res) => {
  try {
    const sales = await Sale.find({
      userId: res.locals.userId,
    }).sort({
      createdAt: -1,
    });

    res.json(sales);
  } catch {
    res.status(500).json({
      message: "Failed to fetch sales",
    });
  }
});

saleRoutes.get("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({
      message: "Sale not found",
    });

    return;
  }

  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      userId: res.locals.userId,
    });

    if (!sale) {
      res.status(404).json({
        message: "Sale not found",
      });

      return;
    }

    res.json(sale);
  } catch {
    res.status(500).json({
      message: "Failed to fetch sale",
    });
  }
});

saleRoutes.delete("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({
      message: "Sale not found",
    });

    return;
  }

  try {
    const sale = await Sale.findOneAndDelete({
      _id: req.params.id,
      userId: res.locals.userId,
    });

    if (!sale) {
      res.status(404).json({
        message: "Sale not found",
      });

      return;
    }

    res.status(204).send();
  } catch {
    res.status(500).json({
      message: "Failed to delete sale",
    });
  }
});

const isPositiveInteger = (
  value: unknown,
): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value > 0;

export default saleRoutes;