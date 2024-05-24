import { Schema, model } from 'mongoose';

const featureFlagSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    users: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        enabled: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

const FeatureFlag = model('FeatureFlag', featureFlagSchema);
export default FeatureFlag;
