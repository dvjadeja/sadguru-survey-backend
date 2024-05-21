import { Schema, model } from 'mongoose';

const dailyLogSchema = new Schema(
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
    trips: {
      type: Number,
      required: true,
    },
    fuel: {
      type: Number,
      required: true,
    },
    tripIncentive: Number,
    remarks: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const DailyLog = model('DailyLog', dailyLogSchema);

export default DailyLog;
