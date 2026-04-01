import { Router } from 'express';
import { Request, Response } from 'express';

const router = Router();

// GET /api/categories
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Categories list - coming soon',
  });
});

// GET /api/categories/:slug
router.get('/:slug', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Get category by slug - coming soon',
    slug: req.params.slug,
  });
});

export default router;