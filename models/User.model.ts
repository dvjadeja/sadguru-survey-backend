import { Model, model, Schema } from 'mongoose';

import { ROLES } from '../constants';

// Interface for subscription history
interface ISubscriptionHistory {
  subscriptionStartDate: Date;
  subscriptionEndDate: Date;
}

// Interface for User
interface IUser extends Document {
  firstName: string;
  lastName: string;
  fullName: string;
  role: any;
  email: string;
  password: string;
  phone: string;
  company: {
    name: string;
    address: string;
    zipCode: string;
    state: string;
    country: string;
    logo: string;
    stamp: string;
    prefix: string;
    pan: string;
    gst: string;
  };
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    branch: string;
  };
  isSubscribed: boolean; // If the user has an active subscription
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  trialStartDate: Date | null; // Date when free trial starts
  trialEndDate: Date | null; // Date when free trial ends
  hasUsedFreeTrial: boolean; // True if the user has already used the free trial
  subscriptionHistory: ISubscriptionHistory[] | null; // History of previous subscriptions
  checkSubscriptionStatus: () => boolean;
  checkTrialStatus: () => boolean;
}

const userSchema = new Schema<IUser>(
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
      gst: String,
    },
    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      bankName: String,
      ifscCode: String,
      branch: String,
    },
    // Subscription-related fields
    isSubscribed: { type: Boolean, default: false },
    subscriptionStartDate: { type: Date, default: null },
    subscriptionEndDate: { type: Date, default: null },
    trialStartDate: {
      type: Date,
      default: null, // Free trial start, null if not started
    },
    trialEndDate: {
      type: Date,
      default: null, // Free trial end, null if not started
    },
    hasUsedFreeTrial: { type: Boolean, default: false }, // User can avail trial once
    subscriptionHistory: {
      type: [
        {
          subscriptionStartDate: { type: Date },
          subscriptionEndDate: { type: Date },
        },
      ],
      default: null,
    }, // Track subscription history
  },
  { timestamps: true }
);

// Method to check subscription status
userSchema.methods.checkSubscriptionStatus = function (): boolean {
  const currentDate = new Date();

  // Check if the user has an active subscription
  if (
    this.isSubscribed &&
    this.subscriptionEndDate &&
    currentDate < this.subscriptionEndDate
  ) {
    return true; // Subscription is still valid
  }

  // No active subscription, mark as unsubscribed
  this.isSubscribed = false;
  return this.isSubscribed; // User needs to subscribe
};

// Method to check trial status
userSchema.methods.checkTrialStatus = function (): boolean {
  const currentDate = new Date();

  // Check if trial is ongoing
  if (
    this.trialStartDate &&
    this.trialEndDate &&
    currentDate < this.trialEndDate
  ) {
    return true; // Trial is active
  }

  // If trial has ended, set flags appropriately
  if (this.trialEndDate && currentDate > this.trialEndDate) {
    this.hasUsedFreeTrial = true; // Mark that the user has already used the trial
  }

  return false; // Trial is not active
};

const UserModel: Model<IUser> = model<IUser>('Users', userSchema);

export default UserModel;
