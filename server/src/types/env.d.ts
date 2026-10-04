declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    MONGO_URI: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    MASTER_KEY: string;
    MASTER_KEY_VERSION: string;
    CLIENT_ORIGIN: string;
    COOKIE_DOMAIN?: string;
    COOKIE_SAMESITE: 'Strict' | 'Lax' | 'None';
    LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
    PLATFORM_ADMIN_EMAIL?: string;
    PLATFORM_ADMIN_PASSWORD?: string;
  }
}