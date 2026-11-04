import mongoose from 'mongoose';
import { logger } from './boot-validation.service.js';

export async function connectMongo(uri: string): Promise<void> {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    mongoose.connection.on('error', (err) => {
        logger.error({ err }, 'MongoDB connection error');
    });
}

export async function disconnectMongo(): Promise<void> {
    await mongoose.disconnect();
}
