import { Schema, model } from 'mongoose';
import { PAYMENT_TYPE } from '../constants';

const driverSalarySchema = new Schema(
  {
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    driverName: {
      type: String,
      required: true,
    },
    month: {
      type: String,
      enum: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ],
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    basicSalary: {
      type: Number,
      required: true,
    },
    incentives: {
      type: Number,
      default: 0,
    },
    deductions: {
      type: Number,
      default: 0,
    },
    totalSalary: {
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
    paymentDate: {
      type: Date,
      default: null,
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

const DriverSalary = model('DriverSalary', driverSalarySchema);

export default DriverSalary;
