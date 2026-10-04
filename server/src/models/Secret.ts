import mongoose, { type Document } from 'mongoose';

export interface SecretDoc extends Document {
  projectId: mongoose.Types.ObjectId;
  environment: 'development' | 'staging' | 'production';
  key: string;
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  encryptionKeyVersion: number;
  createdBy: mongoose.Types.ObjectId;
  lastEditedBy: mongoose.Types.ObjectId | null;
  lastAccessedAt: Date | null;
  lastAccessedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const secretSchema = new mongoose.Schema<SecretDoc>(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    environment: { type: String, enum: ['development', 'staging', 'production'], required: true },
    key: { type: String, required: true, match: /^[A-Z0-9_]{1,100}$/ },
    ciphertext: { type: Buffer, required: true, select: false },
    iv: { type: Buffer, required: true, select: false },
    authTag: { type: Buffer, required: true, select: false },
    encryptionKeyVersion: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastAccessedAt: { type: Date, default: null },
    lastAccessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

secretSchema.index({ projectId: 1, environment: 1, key: 1 }, { unique: true });

export const SecretModel = mongoose.model<SecretDoc>('Secret', secretSchema);
