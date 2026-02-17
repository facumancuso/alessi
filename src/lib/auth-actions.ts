'use server';

import bcrypt from 'bcryptjs';
import { connectToDatabase } from './mongodb';
import { UserModel } from './models';
import type { User } from './types';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-cambialo-en-produccion';

export async function createUser(userData: Partial<User & { password?: string }>): Promise<User> {
  await connectToDatabase();

  if (!userData.email) {
    throw new Error('Email is required to create a user.');
  }

  const normalizedEmail = userData.email.toLowerCase();

  const existingUser = await UserModel.findOne({ email: normalizedEmail }).lean();

  if (existingUser) {
    console.log(`User with email ${normalizedEmail} already exists. Skipping creation.`);
    return {
      id: existingUser._id.toString(),
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role,
      isActive: existingUser.isActive,
    };
  }

  if (!userData.password) {
    throw new Error('Password is required for new users.');
  }

  // Hash password before storing
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  const newUser = await UserModel.create({
    name: userData.name || '',
    email: normalizedEmail,
    password: hashedPassword,
    role: userData.role || 'Peluquero',
    isActive: userData.isActive ?? true,
  });

  return {
    id: newUser._id.toString(),
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    isActive: newUser.isActive,
  };
}

export async function updateUser(id: string, userUpdate: Partial<User & { password?: string }>): Promise<User | undefined> {
  await connectToDatabase();

  const updateData: any = { ...userUpdate };

  // If password is being updated, hash it
  if (userUpdate.password) {
    updateData.password = await bcrypt.hash(userUpdate.password, 10);
  }

  const updated = await UserModel.findByIdAndUpdate(id, updateData, { new: true }).select('-password').lean();

  if (!updated) return undefined;

  return {
    id: updated._id.toString(),
    name: updated.name,
    email: updated.email,
    role: updated.role,
    isActive: updated.isActive,
  };
}

export async function deleteUser(id: string): Promise<boolean> {
  await connectToDatabase();
  await UserModel.findByIdAndDelete(id);
  return true;
}

export async function signIn(email: string, password: string): Promise<User | null> {
  await connectToDatabase();

  const user = await UserModel.findOne({ email: email.toLowerCase() }).lean();

  if (!user || !user.isActive) {
    return null;
  }

  // Compare password with hashed password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return null;
  }

  // Create JWT token
  const token = jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Set cookie
  (await cookies()).set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function signOut() {
  (await cookies()).delete('auth-token');
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token');

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token.value, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
    };

    await connectToDatabase();
    const user = await UserModel.findById(decoded.userId).select('-password').lean();

    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  } catch (error) {
    return null;
  }
}
