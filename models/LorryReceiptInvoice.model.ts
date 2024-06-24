import { Schema, model } from 'mongoose';

const otherOrganizationDetails = {
  companyName: {
    type: String,
    required: true,
  },
  gst: String,
  pan: String,
  address: String,
  city: String,
  state: String,
  zipCode: String,
  bankDetails: {
    accountHolderName: String,
    accountNumber: String,
    bankName: String,
    ifscCode: String,
    branch: String,
  },
};

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
  organizationDetails: otherOrganizationDetails,
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
  additionalNonTaxableAmount: {
    type: Number,
    default: 0,
  },
  subTotal: {
    type: Number,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  remarks: String,
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
