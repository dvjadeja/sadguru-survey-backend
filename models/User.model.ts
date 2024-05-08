import { model, Schema } from 'mongoose';

import { ROLES } from '../constants';

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: [ROLES.ADMIN, ROLES.USER],
      default: ROLES.USER,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    company: {
      name: String,
      address: String,
      zipCode: String,
      state: String,
      country: String,
      logo: String,
      stamp: String,
      prefix: String,
      pan: String,
      gst: String
    },
  },
  { timestamps: true }
);

const UserModel = model('Users', userSchema);

export default UserModel;
