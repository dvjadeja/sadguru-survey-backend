import { model } from 'mongoose';
import { Schema } from 'mongoose';

const vendorSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    gst: {
      type: String,
      required: true,
    },
    pan: {
      type: String,
      required: true,
    },
    totalAmount: String,
    pendingAmount: String,
    paidAmount: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const VendorModel = model('Vendor', vendorSchema);

export default VendorModel;
