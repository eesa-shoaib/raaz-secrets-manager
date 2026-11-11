import mongoose, { type Document } from 'mongoose';

export interface UserAvatarDoc extends Document {
    userId: mongoose.Types.ObjectId;
    data: Buffer;
    contentType: 'image/png' | 'image/jpeg' | 'image/webp';
    width: number;
    height: number;
    byteLength: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

const userAvatarSchema = new mongoose.Schema<UserAvatarDoc>(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        data: { type: Buffer, required: true },
        contentType: {
            type: String,
            enum: ['image/png', 'image/jpeg', 'image/webp'],
            required: true,
        },
        width: { type: Number, required: true, min: 1, max: 256 },
        height: { type: Number, required: true, min: 1, max: 256 },
        byteLength: { type: Number, required: true, min: 1, max: 131_072 },
        version: { type: Number, required: true, min: 1, default: 1 },
    },
    { timestamps: true, collection: 'userAvatars' },
);

export const UserAvatarModel = mongoose.model<UserAvatarDoc>('UserAvatar', userAvatarSchema);
