import { model, Schema } from 'mongoose';

const expensesSchema = {
  description: {
    type: String,
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
  amount: {
    type: Schema.Types.Decimal128,
    required: true,
  },
};

const fuelSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    receiptId: {
      type: String,
      required: true,
    },
    expenses: [expensesSchema],
    totalAmount: Schema.Types.Decimal128,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const FuelModel = model('Fuel', fuelSchema);

export default FuelModel;
