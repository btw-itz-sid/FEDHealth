import { Request, Response, NextFunction } from 'express';

export const browserSecurity = (allowedOrigins: string[]) => (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) return res.status(403).json({ message: 'Origin is not allowed' });
      if (req.headers.cookie?.includes('fedhealth_session=') && req.headers['x-fedhealth-client'] !== 'web' && !req.headers.authorization) return res.status(403).json({ message: 'Request verification failed' });
    }
    next();
};
