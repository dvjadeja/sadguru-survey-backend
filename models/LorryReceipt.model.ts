import { Schema, model } from 'mongoose';

const lorryReceiptSchema = new Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    lorryReceiptId: {
      type: String,
      required: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    modeOfTrade: {
      type: String,
      required: true,
    },
    bookingNo: String,
    containerNo: String,
    lineSeal: String,
    containerSize: String,
    billingParty: {
      type: Schema.Types.ObjectId,
      ref: 'Ledger',
      required: true,
    },
    rate: Number,
    detentionAmount: Number,
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      required: true,
    },
    diesel: Number,
    advance: Number,
    tollPlazaAmount: Number,
    adaniFee: Number,
    remarks: String,
    ownVehicle: {
      type: Boolean,
      default: true,
      required: true,
    },
    marketTruckDetails: {
      companyName: String,
      marketRate: Number,
      vehiclePlateNumber: String,
      driverName: String,
      driverPhone: String,
    },
    ownOrganization: {
      type: Boolean,
      default: true,
      required: true,
    },
    organizationDetails: {
      companyName: String,
      gst: String,
      pan: String,
      address: String,
      zipCode: String,
      state: String,
      country: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const LorryReceipt = model('LorryReceipt', lorryReceiptSchema);

export default LorryReceipt;
