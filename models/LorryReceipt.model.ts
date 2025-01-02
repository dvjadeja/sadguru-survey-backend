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
    },
    modeOfTrade: {
      type: String,
      enum: ['IMPORT', 'EXPORT'],
      required: true,
    },
    bookingNo: String,
    containerNo: String,
    lineSeal: String,
    containerSize: String,
    containerStatus: {
      type: String,
      enum: ['EMPTY', 'LOADED'],
    },
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
      type: Schema.Types.ObjectId,
      ref: 'OtherOrganization',
    },
    invoiceStatus: {
      type: String,
      enum: ['PENDING', 'GENERATED'],
      default: 'PENDING',
      required: true,
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
