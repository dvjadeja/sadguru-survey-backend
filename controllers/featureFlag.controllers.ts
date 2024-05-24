import { Request, Response } from 'express';
import { FeatureFlag, Users } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';

export const getFeatureFlagsForUser = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const featureFlags = await FeatureFlag.find({ 'users.userId': userId });

    if (!featureFlags) throw new Error('No feature flags found');

    const userFeatureFlags = featureFlags.map((flag) => ({
      name: flag.name,
      enabled: flag?.users?.find(
        (userFlag) => userFlag?.userId?.toString() === userId
      )?.enabled,
    }));

    handleSuccess(res, {
      message: 'Feature flags fetched successfully',
      data: userFeatureFlags,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching feature flags',
      error,
    });
  }
};

// Create a new feature flag
export const createFeatureFlag = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const users = await Users.find({}).select('_id');
    const userFlags = users.map((user) => ({
      userId: user._id,
      enabled: false,
    }));

    const featureFlag = new FeatureFlag({
      name,
      users: userFlags,
    });

    const registerFeature = await featureFlag.save();
    handleSuccess(res, {
      message: 'Feature flag created successfully',
      data: registerFeature,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while creating feature flag',
      error,
    });
  }
};

// Toggle feature flag for a user
export const toggleFeatureForUser = async (req: Request, res: Response) => {
  try {
    const { userId, featureId, enabled } = req.body;
    const featureFlag = await FeatureFlag.findOne({ _id: featureId });
    if (!featureFlag) {
      throw new Error('Feature flag not found');
    }

    const userFlag = featureFlag.users.find(
      (userFlag) => userFlag?.userId?.toString() === userId
    );
    if (userFlag) {
      userFlag.enabled = enabled;
    } else {
      featureFlag.users.push({ userId, enabled });
    }

    await featureFlag.save({ validateBeforeSave: false });

    handleSuccess(res, {
      message: 'Feature flag toggled successfully',
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while toggling feature flag',
      error,
    });
  }
};
