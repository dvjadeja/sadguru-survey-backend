import { model, Schema } from 'mongoose';

const marketTruckFuelSchema = new Schema(
  {
    lorryReceiptId: {
      type: Schema.Types.ObjectId,
      ref: 'LorryReceipt',
      required: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    quantity: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    rate: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    totalAmount: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const MarketTruckFuelModel = model('MarketTruckFuel', marketTruckFuelSchema);

export default MarketTruckFuelModel;
