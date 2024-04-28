import { model, Schema } from 'mongoose';
import { VEHICLE_STATUS, VEHICLE_TAX_TYPE } from '../constants';

const vehicleSchema = new Schema(
  {
    make: String,
    model: String,
    vin: String,
    registration: {
      plateNumber: {
        type: String,
        required: true,
      },
    },
    currentStatus: {
      type: String,
      enum: [
        VEHICLE_STATUS.ACTIVE,
        VEHICLE_STATUS.INACTIVE,
        VEHICLE_STATUS.UNDER_MAINTENANCE,
      ],
      default: VEHICLE_STATUS.ACTIVE,
    },
    fuel: {
      fuelCapacity: Number,
      availableFuel: Number,
    },
    insuranceExpirationDate: {
      type: Date,
      required: true,
    },
    registrationDate: {
      type: Date,
      required: true,
    },
    fitness: {
      type: Date,
      required: true,
    },
    tax: {
      taxType: {
        type: String,
        enum: [VEHICLE_TAX_TYPE.LTT, VEHICLE_TAX_TYPE.OTT],
        required: true,
      },
      lastTaxDate: Date,
    },
    puc: {
      type: Date,
      required: true,
    },
    permit: {
      type: Date,
      required: true,
    },
    assignedDriver: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const VehicleModel = model('Vehicle', vehicleSchema);

export default VehicleModel;
