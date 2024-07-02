import { Schema, model } from 'mongoose';

const lorryReceiptInvoiceSchema = new Schema(
  {
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
    dueDate: {
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
    ownOrganization: {
      type: Boolean,
      required: true,
    },
    organizationDetails: {
      type: Schema.Types.ObjectId,
      ref: 'OtherOrganization',
    },
    gstApplicable: {
      type: Boolean,
      default: false,
      required: true,
    },
    gstPercentage: {
      type: Number,
      required: true,
    },
    gstType: {
      type: String,
      enum: ['SGST-CGST', 'IGST'],
    },
    gstAmount: {
      type: Number,
      required: true,
    },
    subTotal: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    remarks: {
      type: String,
      default: '',
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PAID'],
      default: 'UNPAID',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const LorryReceiptInvoice = model(
  'LorryReceiptInvoice',
  lorryReceiptInvoiceSchema
);

export default LorryReceiptInvoice;
