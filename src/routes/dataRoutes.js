import express from 'express';
import {
  uploadPollutionData,
  getPollutionData,
  getPollutionDataById,
  getPollutionStats,
  deletePollutionData,  
  getHeatmapData,
  getRelatedDataById
} from '../controllers/dataController.js';
import { validateFileUpload, validatePagination } from '../middleware/validation.js';
import fileUploader from '../utils/fileUploader.js';

const router = express.Router();

// File upload endpoint
router.post('/upload', 
  fileUploader.createUploadMiddleware('file'),
  validateFileUpload,
  uploadPollutionData
);

// Get heatmap data
router.get('/heatmap', getHeatmapData);

// Get related data for a specific heatmap point
router.get('/heatmap/:id', getRelatedDataById);

// Get pollution data with filters and pagination
router.get('/', validatePagination, getPollutionData);

// Get pollution statistics
router.get('/stats', getPollutionStats);

// Get single pollution data record
router.get('/:id', getPollutionDataById);

// Delete pollution data record
router.delete('/:id', deletePollutionData);

export default router;