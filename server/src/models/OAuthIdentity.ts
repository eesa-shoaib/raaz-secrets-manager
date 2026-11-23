import mongoose from 'mongoose';

const schema = new mongoose.Schema(
    {
        provider: { type: String, enum: ['google', 'github'], required: true },
        subject: { type: String, required: true, select: false },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true },
);
schema.index({ provider: 1, subject: 1 }, { unique: true });
schema.index({ provider: 1, userId: 1 }, { unique: true });
export const OAuthIdentityModel = mongoose.model('OAuthIdentity', schema);
