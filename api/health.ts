import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  res.status(200).json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY)
  });
}
