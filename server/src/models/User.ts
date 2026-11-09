import mongoose, { type Document } from 'mongoose';

export interface UserDoc extends Document {
    email: string;
    username: string | null;
    hasAvatar: boolean;
    avatarUpdatedAt: Date | null;
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
        username: { type: String, lowercase: true, default: null },
        hasAvatar: { type: Boolean, required: true, default: false },
        avatarUpdatedAt: { type: Date, default: null },
        passwordHash: { type: String, required: true, select: false },
        tokenVersion: { type: Number, required: true, default: 0 },
        isPlatformAdmin: { type: Boolean, required: true, default: false },
        isActive: { type: Boolean, required: true, default: true },
    },
    { timestamps: true },
);

userSchema.index(
    { username: 1 },
    {
        unique: true,
        partialFilterExpression: { username: { $type: 'string' } },
    },
);
userSchema.index({ createdAt: -1, _id: -1 });

export const UserModel = mongoose.model<UserDoc>('User', userSchema);
