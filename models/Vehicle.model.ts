import { model, Schema } from 'mongoose';
import { VEHICLE_STATUS } from '../constants';

const vehicleSchema = new Schema(
  {
    make: String,
    model: String,
    year: Number,
    vin: String,
    registration: {
      plateNumber: {
        type: String,
        required: true
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
    insurance: {
      provider: String,
      policyNumber: String,
      expirationDate: Date,
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
