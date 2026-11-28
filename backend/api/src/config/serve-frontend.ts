import { resolve } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response, NextFunction } from 'express';

export function serveFrontend(app: NestExpressApplication, directory = resolve(process.cwd(), '../../frontend/dist')) {
  app.useStaticAssets(directory, { index: false, dotfiles: 'deny' });
  app.getHttpAdapter().getInstance().get('/{*path}', (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    res.sendFile(resolve(directory, 'index.html'));
  });
}
