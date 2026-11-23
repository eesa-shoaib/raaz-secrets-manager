import mongoose from 'mongoose';

const schema = new mongoose.Schema({
    provider: { type: String, enum: ['google', 'github'], required: true },
    state: { type: String, required: true, select: false },
    bindingHash: { type: String, required: true, select: false },
    verifier: { type: String, required: true, select: false },
    nonce: { type: String, required: true, select: false },
    redirectUri: { type: String, required: true },
    intent: { type: String, enum: ['login', 'deactivate'], required: true },
    sessionHash: { type: String, select: false },
    tokenVersion: { type: Number },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date, required: true },
});
schema.index({ state: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const OAuthAttemptModel = mongoose.model('OAuthAttempt', schema);
