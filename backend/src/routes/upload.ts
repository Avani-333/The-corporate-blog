import { Router } from 'express';
import { Request, Response } from 'express';

const router = Router();

router.post('/image', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Image upload - coming soon' });
});

export default router;