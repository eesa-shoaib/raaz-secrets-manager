import type React from 'react';

declare global {
  namespace ReactRouter {
    interface AppRouteObject {
      path?: string;
      index?: boolean;
      children?: AppRouteObject[];
      element?: React.ReactNode;
      loader?: () => Promise<unknown>;
      action?: () => Promise<unknown>;
    }
  }
}

export {};
