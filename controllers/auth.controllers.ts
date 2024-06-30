import { Request, Response } from 'express';

import { Users } from '../models';

import { handleErrors, handleSuccess } from '../utils/response.utils';
import { generateHash, generateToken, verifyHash } from '../utils/auth.utils';

export const register = async (req: Request, res: Response) => {
  try {
    const {
      firstName,
      lastName,
      role,
      email,
      password,
      phone,
      company,
      bankDetails,
    } = req.body;

    if (!firstName) throw new Error('firstName is required');
    if (!lastName) throw new Error('lastName is required');
    if (!role) throw new Error('role is required');
    if (!email) throw new Error('email is required');
    if (!password) throw new Error('password is required');
    if (!phone) throw new Error('phone is required');
    if (!company) throw new Error('company is required');
    if (!bankDetails) throw new Error('bankDetails is required');

    const user = await Users.findOne({ email });

    if (user) throw new Error(`A user with email ${email} already exists`);

    const newUser = new Users({
      firstName: firstName,
      lastName: lastName,
      fullName: `${firstName} ${lastName}`,
      role: role,
      email: email,
      password: await generateHash(password),
      phone: phone,
      company: company,
      bankDetails: bankDetails,
    });

    const registeredUser = await newUser.save();
    if (registeredUser) {
      const token = await generateToken({
        _id: registeredUser._id,
        email: registeredUser.email,
        phone: registeredUser.phone,
        role: registeredUser.role,
      });

      handleSuccess(res, {
        message: 'User Created Successfully',
        data: {
          accessToken: token,
          user: registeredUser,
        },
      });
    }
  } catch (error) {
    handleErrors(req, res, {
      status: 500,
      message: 'Error while creating user.',
      error,
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email) throw new Error('email is required');
    if (!password) throw new Error('password is required');

    const user = await Users.findOne({ email });

    if (!user) {
      throw new Error(`No user found with email ${email}. Please register.`);
    }

    if (!(await verifyHash(password, `${user.password}`)))
      throw new Error(`Incorrect password`);

    // Get today's date
    var today = new Date();

    // Add 1 days to today's date
    var afterThreeDays = new Date(today);
    afterThreeDays.setDate(today.getDate() + 1);

    // Convert the date to Unix timestamp format
    var unixTimestamp = Math.floor(afterThreeDays.getTime() / 1000);

    const token = await generateToken({
      _id: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      exp: unixTimestamp,
    });

    const dataToSend = {
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      email: user.email,
      phone: user.phone,
      company: user.company,
      bankDetails: user.bankDetails,
    };

    handleSuccess(res, {
      message: 'User Logged in Successfully',
      data: {
        accessToken: token,
        user: dataToSend,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      status: 500,
      message: 'Error while logged in user.',
      error,
    });
  }
};

export const authMe = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;

    const user = await Users.findById({ _id: userId });
    if (!user) throw new Error('User not found');

    handleSuccess(res, {
      message: 'User Authenticated Successfully',
      data: user,
    });
  } catch (error) {
    handleErrors(req, res, {
      status: 500,
      message: 'Error while Authenticating user.',
      error,
    });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { role, password, ...rest } = req.body;

    const edited = await Users.findOneAndUpdate({ _id: userId }, rest, {
      new: true,
    });

    if (!edited) throw new Error('Error in Profile Update');

    handleSuccess(res, {
      message: 'Profile Updated Successfully',
      data: {
        updateUser: edited,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      status: 500,
      message: 'Error while updating user.',
      error,
    });
  }
};

export const updatePassword = async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword) throw new Error('Old Password cannot be empty');
    if (!newPassword) throw new Error('New Password cannot be empty.');

    const { userId } = res.locals.user;
    const loggedUser = await Users.findById(userId);
    if (!loggedUser) {
      throw new Error('Please login first');
    }

    if (!(await verifyHash(oldPassword, `${loggedUser.password}`)))
      throw new Error(`Incorrect Old Password`);

    const newHashPassword = await generateHash(newPassword);
    const updatePassword = await Users.findOneAndUpdate(
      { _id: userId },
      { password: newHashPassword },
      { new: true }
    );
    if (!updatePassword) throw new Error('Error in change password');

    handleSuccess(res, {
      message: 'Password Updated successfully',
    });
  } catch (error) {
    handleErrors(req, res, {
      status: 500,
      message: 'Error while updating password.',
      error,
    });
  }
};

export const getUserData = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;

    const user = await Users.findById({ _id: userId });

    if (!user) throw new Error('User not found');

    // Exclude password from response
    const { password, ...userData } = user.toObject();

    handleSuccess(res, {
      message: 'User Data Fetched Successfully',
      data: userData,
    });
  } catch (error) {
    handleErrors(req, res, {
      status: 500,
      message: 'Error while fetching user data.',
      error,
    });
  }
};
