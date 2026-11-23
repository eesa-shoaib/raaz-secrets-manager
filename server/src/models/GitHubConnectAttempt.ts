import mongoose from 'mongoose';

const schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    stateHash: { type: String, required: true, unique: true, select: false },
    sessionHash: { type: String, required: true, select: false },
    verifier: { type: String, required: true, select: false },
    returnTo: { type: String, enum: ['projects', 'settings'], required: true },
    expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const GitHubConnectAttemptModel = mongoose.model('GitHubConnectAttempt', schema);
