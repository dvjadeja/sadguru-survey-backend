import { Schema, model } from 'mongoose';

const localTripSchema = new Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    containerNo: {
      type: String,
      required: true,
    },
    containerSize: {
      type: String,
      enum: ['20', '40'],
      required: true,
    },
    containerType: {
      type: String,
      enum: ['EMPTY', 'LOADED'],
      required: true,
    },
    gateInOutMode: {
      type: String,
      enum: ['INBLOCK', 'RE EXPORT'],
      required: true,
    },
    billingParty: {
      type: Schema.Types.ObjectId,
      ref: 'Ledger',
      required: true,
    },
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      required: true,
    },
    rate: {
      type: Number,
      required: true,
    },
    diesel: {
      type: Number,
      required: true,
    },
    driverIncentive: Number,
    tollPlazaAmount: Number,
    advance: Number,
    remarks: String,
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

const LocalTrip = model('LocalTrip', localTripSchema);

export default LocalTrip;
