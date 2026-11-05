import dns from 'node:dns';
import mongoose from 'mongoose';
import { logger } from './boot-validation.service.js';

export async function connectMongo(uri: string): Promise<void> {
    if (uri.startsWith('mongodb+srv://')) {
        try {
            dns.setServers(['8.8.8.8', '1.1.1.1']);
        } catch {
            // ignore if system restricts dns override
        }
    }
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    mongoose.connection.on('error', (err) => {
        logger.error({ err }, 'MongoDB connection error');
    });
}

export async function disconnectMongo(): Promise<void> {
    await mongoose.disconnect();
}
