import { Schema, model } from 'mongoose';

const ledgerSchema = new Schema(
  {
    gstin: String,
    totalAmount: {
      type: Schema.Types.Decimal128,
      required: true,
      default: 0,
    },
    paidAmount: {
      type: Schema.Types.Decimal128,
      required: true,
      default: 0,
    },
    pendingAmount: {
      type: Schema.Types.Decimal128,
      required: true,
      default: 0,
    },
    tradeName: {
      type: String,
      required: true,
    },
    legalName: {
      type: String,
      required: true,
    },
    gstStatus: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'PENDING'],
    },
    pan: String,
    address: {
      address: String,
      city: String,
      district: String,
      state: String,
      pincode: String,
    },
    contactName: String,
    contactNumber: String,
    email: String,
    remarks: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const Ledger = model('Ledger', ledgerSchema);

export default Ledger;
