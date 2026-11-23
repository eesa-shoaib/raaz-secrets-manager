import mongoose from 'mongoose';

export interface GitHubCredentials {
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
    encryptionKeyVersion: number;
}
export interface GitHubConnectionDoc {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    subject: string;
    login: string;
    credentials: GitHubCredentials;
    refreshLease: string | null;
    refreshUntil: Date | null;
    createdAt: Date;
}
const credentialsSchema = new mongoose.Schema(
    { ciphertext: Buffer, iv: Buffer, authTag: Buffer, encryptionKeyVersion: Number },
    { _id: false },
);
export const GitHubConnectionModel = mongoose.model<GitHubConnectionDoc>(
    'GitHubConnection',
    new mongoose.Schema<GitHubConnectionDoc>(
        {
            userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
            subject: { type: String, required: true, select: false },
            login: { type: String, required: true },
            credentials: { type: credentialsSchema, required: true, select: false },
            refreshLease: { type: String, default: null, select: false },
            refreshUntil: { type: Date, default: null, select: false },
        },
        { timestamps: true },
    ),
);
