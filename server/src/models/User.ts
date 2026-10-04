import mongoose, { type Document } from 'mongoose';

export interface UserDoc extends Document {
  email: string;
  passwordHash: string;
  tokenVersion: number;
  isPlatformAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, required: true, default: 0 },
    isPlatformAdmin: { type: Boolean, required: true, default: false },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<UserDoc>('User', userSchema);