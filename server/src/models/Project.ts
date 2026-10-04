import mongoose, { type Document } from 'mongoose';

export interface ProjectDoc extends Document {
  name: string;
  environments: ('development' | 'staging' | 'production')[];
  activeAdminCount: number;
  status: 'active' | 'archived';
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new mongoose.Schema<ProjectDoc>(
  {
    name: { type: String, required: true, maxlength: 100 },
    environments: {
      type: [String],
      enum: ['development', 'staging', 'production'],
      required: true,
    },
    activeAdminCount: { type: Number, required: true, default: 1 },
    status: { type: String, enum: ['active', 'archived'], required: true, default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const ProjectModel = mongoose.model<ProjectDoc>('Project', projectSchema);
