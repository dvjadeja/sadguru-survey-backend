import { Schema, model } from 'mongoose';

const otherOrganizationSchema = new Schema(
  {
    companyName: {
      type: String,
      required: true,
    },
    gst: String,
    pan: String,
    address: String,
    state: String,
    zipCode: String,
    country: String,
    logo: String,
    stamp: String,
    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      bankName: String,
      ifscCode: String,
      branch: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const OtherOrganization = model('OtherOrganization', otherOrganizationSchema);

export default OtherOrganization;
