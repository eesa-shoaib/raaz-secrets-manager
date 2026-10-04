import mongoose from 'mongoose';

export async function connectMongo(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
