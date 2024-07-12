import { Schema, model } from 'mongoose';
import { PAYMENT_TYPE } from '../constants';

const additionalAmount = {
  description: String,
  amount: Number,
};

const deductionAmount = {
  description: String,
  amount: Number,
};

const driverFNFSchema = new Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    driverSalary: {
      type: Number,
      required: true,
    },
    driverIncentive: {
      type: Number,
      required: true,
      default: 0,
    },
    availableFuel: {
      type: Number,
      required: true,
    },
    fuelTankFinger: {
      type: Number,
      required: true,
    },
    fuelPerFinger: {
      type: Number,
      required: true,
    },
    fuelRate: {
      type: Number,
      required: true,
    },
    additionalAmount: [additionalAmount],
    deductionAmount: [deductionAmount],
    totalAmount: {
      type: Number,
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
    remarks: {
      type: String,
      default: '',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const DriverFNF = model('DriverFNF', driverFNFSchema);

export default DriverFNF;
