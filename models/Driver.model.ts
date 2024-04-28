import { model, Schema } from 'mongoose';

const driverSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true,
    },
    licenseExpirationDate: {
      type: Date,
      required: true,
    },
    phoneNumber: {
      primary: {
        type: String,
        required: true,
      },
      secondary: String,
    },
    adharCard: {
      type: String,
      required: true,
      unique: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    assignedVehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
    },
    availableFuel: {
      type: Number,
      required: true,
      default: 0,
    },
    onboardingFuel: {
      type: Number,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const DriverModel = model('Driver', driverSchema);

export default DriverModel;
