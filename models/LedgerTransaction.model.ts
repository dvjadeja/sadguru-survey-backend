import { Schema, model } from 'mongoose';
import { PAYMENT_TYPE } from '../constants';

const ledgerTransactionSchema = new Schema(
  {
    ledgerId: {
      type: Schema.Types.ObjectId,
      ref: 'Ledger',
      required: true,
    },
    invoiceType: {
      type: String,
      enum: ['LorryReceiptInvoice', 'LocalTripInvoice'],
      required: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      refPath: 'invoiceType',
      required: true,
    },
    invoiceAmount: {
      type: Number,
      required: true,
    },
    tds: {
      type: Number,
      required: true,
      default: 0,
    },
    amountAfterTds: {
      type: Number,
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

const LedgerTransactionModel = model(
  'LedgerTransaction',
  ledgerTransactionSchema
);

export default LedgerTransactionModel;
