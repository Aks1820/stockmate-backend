import { model, Schema, Types } from "mongoose";

export interface Sale {
  userId: string;
  productId: Types.ObjectId;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  total: number;
  totalCost: number;
  profit: number;
  createdAt: Date;
}

const saleSchema = new Schema<Sale>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    productId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Product",
    },

    productName: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },

    profit: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

saleSchema.index({
  userId: 1,
  createdAt: -1,
});

saleSchema.index({
  userId: 1,
  productId: 1,
  createdAt: -1,
});

export default model<Sale>("Sale", saleSchema);