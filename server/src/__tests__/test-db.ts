import crypto from 'node:crypto';
import { config } from 'dotenv';
import mongoose from 'mongoose';

config();

export interface TestDbHandle {
    connected: boolean;
    dbName: string;
    clearCollections: () => Promise<void>;
    disconnect: () => Promise<void>;
}

function buildDisposableTestUri(baseUri: string, dbName: string): string {
    if (!dbName.startsWith('raaz_test_')) {
        throw new Error(`Refusing to use non-disposable test database name: ${dbName}`);
    }
    const url = new URL(baseUri);
    url.pathname = `/${dbName}`;
    return url.toString();
}

export async function connectDisposableTestDb(suitePrefix = 'suite'): Promise<TestDbHandle> {
    const baseUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI;
    const suffix = `${suitePrefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 24);
    const dbName = `raaz_test_${suffix}`;

    if (!baseUri) {
        return {
            connected: false,
            dbName,
            clearCollections: async () => {},
            disconnect: async () => {},
        };
    }

    const testUri = buildDisposableTestUri(baseUri, dbName);

    try {
        await mongoose.connect(testUri, {
            dbName,
            serverSelectionTimeoutMS: 5000,
        });

        const activeDbName = mongoose.connection.db?.databaseName ?? '';
        if (!activeDbName.startsWith('raaz_test_')) {
            await mongoose.disconnect();
            throw new Error(`Safety guard triggered: connected database "${activeDbName}" does not start with raaz_test_`);
        }

        return {
            connected: true,
            dbName: activeDbName,
            clearCollections: async () => {
                const currentDb = mongoose.connection.db;
                if (!currentDb || !currentDb.databaseName.startsWith('raaz_test_')) {
                    throw new Error('Refusing to clear collections on non-test database');
                }
                const collections = await currentDb.collections();
                await Promise.all(collections.map((col) => col.deleteMany({})));
            },
            disconnect: async () => {
                const currentDb = mongoose.connection.db;
                if (currentDb && currentDb.databaseName.startsWith('raaz_test_')) {
                    await currentDb.dropDatabase();
                }
                await mongoose.disconnect();
            },
        };
    } catch {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect().catch(() => {});
        }
        return {
            connected: false,
            dbName,
            clearCollections: async () => {},
            disconnect: async () => {},
        };
    }
}
