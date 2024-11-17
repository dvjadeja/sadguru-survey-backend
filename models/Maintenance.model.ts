import { Schema, model } from 'mongoose';

const maintenanceSchema = new Schema(
  {
    billNumber: {
      type: String,
      required: true,
    },
    billDate: {
      type: Date,
      required: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    billAmount: {
      type: String,
      required: true,
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

const Maintenance = model('Maintenance', maintenanceSchema);

export default Maintenance;
