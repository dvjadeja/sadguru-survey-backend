import { Schema, model } from 'mongoose';

const lorryReceiptInvoiceSchema = new Schema({
  invoiceNo: {
    type: String,
    required: true,
  },
  ledgerId: {
    type: Schema.Types.ObjectId,
    ref: 'Ledger',
    required: true,
  },
  invoiceDate: {
    type: Date,
    required: true,
  },
  lorryReceiptIds: [
    {
      type: Schema.Types.ObjectId,
      ref: 'LorryReceipt',
      required: true,
    },
  ],
  gstApplicable: {
    type: Boolean,
    default: false,
    required: true,
  },
  gstType: {
    type: String,
    enum: ['SGST-CGST', 'IGST'],
  },
  additionalNonTaxableAmount: {
    type: Number,
    default: 0,
  },
  amount: {
    type: Number,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
});

const LorryReceiptInvoice = model(
  'LorryReceiptInvoice',
  lorryReceiptInvoiceSchema
);

export default LorryReceiptInvoice;
