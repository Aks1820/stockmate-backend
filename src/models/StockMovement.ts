import { model, Schema, Types } from "mongoose";

export type StockMovementType =
  | "initial"
  | "sale"
  | "purchase"
  | "adjustment"
  | "damage"
  | "return";

export interface StockMovement {
  productId: Types.ObjectId;
  userId: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  createdAt: Date;
}

const stockMovementSchema = new Schema<StockMovement>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    userId: {
      type: String,
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "initial",
        "sale",
        "purchase",
        "adjustment",
        "damage",
        "return",
      ],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
    },

    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },

    newStock: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

stockMovementSchema.index({
  userId: 1,
  productId: 1,
  createdAt: -1,
});

export default model<StockMovement>(
  "StockMovement",
  stockMovementSchema,
);