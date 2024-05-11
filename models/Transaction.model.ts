import { Schema, model } from 'mongoose';
import { PAYMENT_TYPE } from '../constants';

const transactionSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    amount: {
      type: String,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
    },
    paymentMethod: {
      paymentType: {
        type: String,
        enum: [
          PAYMENT_TYPE.CASH,
          PAYMENT_TYPE.RTGS,
          PAYMENT_TYPE.NEFT,
          PAYMENT_TYPE.CHEQUE,
          PAYMENT_TYPE.UPI,
        ],
        required: true,
      },
      paymentReferenceNumber: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const TransactionModel = model('Transaction', transactionSchema);

export default TransactionModel;
