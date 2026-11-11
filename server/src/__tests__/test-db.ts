import crypto from 'node:crypto';
import dns from 'node:dns';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import '../models/index.js';

config();

export interface TestDbHandle {
    connected: boolean;
    dbName: string;
    clearCollections: () => Promise<void>;
    disconnect: () => Promise<void>;
}

export async function connectDisposableTestDb(suitePrefix = 'suite'): Promise<TestDbHandle> {
    const baseUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI;
    const suffix =
        `${suitePrefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 24);
    const dbName = `raaz_test_${suffix}`;

    if (!dbName.startsWith('raaz_test_')) {
        throw new Error(`Refusing to use non-disposable test database name: ${dbName}`);
    }

    if (!baseUri) {
        if (process.env.REQUIRE_TEST_DB === 'true') {
            throw new Error('REQUIRE_TEST_DB=true but neither TEST_MONGO_URI nor MONGO_URI is set');
        }
        return {
            connected: false,
            dbName,
            clearCollections: async () => {},
            disconnect: async () => {},
        };
    }

    try {
        if (baseUri.startsWith('mongodb+srv://')) {
            dns.setServers(['8.8.8.8', '1.1.1.1']);
        }
        await mongoose.connect(baseUri, {
            dbName,
            serverSelectionTimeoutMS: 8000,
        });

        const activeDbName = mongoose.connection.db?.databaseName ?? '';
        if (!activeDbName.startsWith('raaz_test_')) {
            await mongoose.disconnect();
            throw new Error(
                `Safety guard triggered: connected database "${activeDbName}" does not start with raaz_test_`,
            );
        }

        // Pre-create collections and indexes before multi-document transactions execute.
        await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

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
    } catch (err) {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect().catch(() => {});
        }
        if (process.env.REQUIRE_TEST_DB === 'true') {
            throw err;
        }
        console.warn(
            '[test-db] replica-set connection skipped:',
            err instanceof Error ? err.message : String(err),
        );
        return {
            connected: false,
            dbName,
            clearCollections: async () => {},
            disconnect: async () => {},
        };
    }
}
