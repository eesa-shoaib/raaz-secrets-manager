import mongoose, { type Document, type Model } from 'mongoose';

export interface PlatformConfigDoc {
  _id: 'singleton';
  activePlatformAdminCount: number;
  updatedAt: Date;
}

const configSchema = new mongoose.Schema<PlatformConfigDoc>(
  {
    _id: { type: String, default: 'singleton' },
    activePlatformAdminCount: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export const PlatformConfigModel = mongoose.model<PlatformConfigDoc>('PlatformConfig', configSchema) as Model<PlatformConfigDoc> & {
  findById(id: 'singleton'): Promise<PlatformConfigDoc | null>;
};