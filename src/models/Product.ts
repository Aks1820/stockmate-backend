import { model, Schema } from "mongoose";

export interface Product {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  lowStockThreshold: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<Product>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    barcode: {
      type: String,
      default: "",
      trim: true,
    },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 5 },
    userId: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

productSchema.index({ userId: 1, sku: 1 }, { unique: true });
productSchema.index({ userId: 1, createdAt: -1 });

export default model<Product>("Product", productSchema);
