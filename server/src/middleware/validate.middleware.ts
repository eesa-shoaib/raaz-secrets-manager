import type { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';

const fieldGuidance: Record<string, string> = {
    'params.projectId': 'projectId must be a valid 24-character hexadecimal ID',
    'params.secretId': 'secretId must be a valid 24-character hexadecimal ID',
    'params.userId': 'userId must be a valid 24-character hexadecimal ID',
    'body.key': 'key must contain 1–100 uppercase letters, numbers, or underscores',
    'body.environment': 'environment must be development, staging, or production',
    'query.environment': 'environment must be development, staging, or production',
    'body.value': 'value must be a string no longer than 4096 characters',
    'body.email': 'email must be a valid email address',
    'body.password': 'password does not meet the requirements for this request',
    'body.name': 'name must contain 1–100 characters',
    'body.role': 'role must be projectAdmin, developer, or auditor',
    'body.confirm': 'confirm must be a boolean',
};

export function validate(schema: AnyZodObject) {
    return asyncHandler(async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            await schema.parseAsync({ body: req.body, query: req.query, params: req.params });
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                const messages = [
                    ...new Set(
                        err.issues.map(
                            (issue) =>
                                fieldGuidance[issue.path.join('.')] ??
                                'Request contains an invalid field',
                        ),
                    ),
                ];
                next(new AppError(422, 'VALIDATION_ERROR', messages.join('; ')));
                return;
            }
            next(err);
        }
    });
}
