import { Router } from 'express';
import {
  createCycle,
  getAllCycles,
  getActiveCycle,
  activateCycle,
} from '../controllers/academicCycle.controller';

const router = Router();

router.post('/', createCycle);
router.get('/', getAllCycles);
router.get('/active', getActiveCycle);
router.patch('/:id/activate', activateCycle);

export default router;
