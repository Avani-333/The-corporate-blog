import { Router } from 'express';
import { Request, Response } from 'express';

const router = Router();

router.get('/profile', (req: Request, res: Response) => {
  res.json({ success: true, message: 'User profile - coming soon' });
});

export default router;