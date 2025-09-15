import { PollutionData } from '../models/index.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import ExcelParser from '../utils/excelParser.js';
import fileUploader from '../utils/fileUploader.js';
import hmpiCalculator from '../utils/hmpiCalculator.js';

/**
 * @desc    Upload and process Excel file with pollution data
 * @route   POST /api/data/upload
 * @access  Public
 */
export const uploadPollutionData = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No file uploaded', 400));
  }

  let filePath = req.file.path;
  
  try {
    // Validate uploaded file
    const fileValidation = await fileUploader.validateFile(req.file);
    if (!fileValidation.isValid) {
      await fileUploader.cleanupFile(filePath);
      return next(new AppError(fileValidation.errors.join(', '), 400));
    }

    // Get file metadata
    const fileMetadata = await fileUploader.getFileMetadata(req.file);

    // Check if file was already processed (by hash)
    const existingData = await PollutionData.findOne({ 
      'processing.fileHash': fileMetadata.hash 
    });

    if (existingData) {
      await fileUploader.cleanupFile(filePath);
      return next(new AppError('This file has already been processed', 409));
    }

    // Parse Excel file
    const parser = new ExcelParser();
    const parseResult = await parser.processFile(filePath);

    if (!parseResult.success) {
      await fileUploader.cleanupFile(filePath);
      return next(new AppError(`File parsing failed: ${parseResult.error}`, 400));
    }

    if (parseResult.data.length === 0) {
      await fileUploader.cleanupFile(filePath);
      return next(new AppError('No valid data found in file', 400));
    }

    // Process each record
    const processedRecords = [];
    const processingErrors = [];

    for (const record of parseResult.data) {
      try {
        // Validate record
        const recordValidation = parser.validateRecord(record);
        
        // Convert to heavy metals map format expected by calculator
        const heavyMetalsForCalculation = {};
        for (const [metal, data] of Object.entries(record.heavyMetals)) {
          heavyMetalsForCalculation[metal] = {
            value: data.value,
            unit: data.unit
          };
        }

        // Calculate HMPI if heavy metals are present
        let pollutionIndices = {};
        if (Object.keys(heavyMetalsForCalculation).length > 0) {
          try {
            const assessment = await hmpiCalculator.calculateComprehensiveAssessment(heavyMetalsForCalculation);
            pollutionIndices = {
              hmpi: assessment.hmpi,
              customIndices: assessment.alternativeIndices || {}
            };
          } catch (calcError) {
            console.warn(`HMPI calculation failed for record ${record.rowNumber}:`, calcError.message);
            pollutionIndices = {
              hmpi: {
                value: null,
                category: 'Unknown',
                calculatedAt: new Date()
              }
            };
          }
        }

        // Create PollutionData document
        const pollutionDataDoc = new PollutionData({
          location: record.location,
          coordinates: record.coordinates,
          sampleInfo: record.sampleInfo,
          heavyMetals: new Map(Object.entries(record.heavyMetals)),
          environmentalParams: new Map(Object.entries(record.environmentalParams || {})),
          pollutionIndices,
          originalData: record.originalData,
          processing: {
            uploadedBy: null, 
            uploadedAt: new Date(),
            fileName: fileMetadata.originalName,
            fileHash: fileMetadata.hash,
            processingStatus: 'processed',
            processingErrors: recordValidation.errors.map(error => ({
              field: 'validation',
              message: error,
              timestamp: new Date()
            })),
            lastCalculated: new Date()
          },
          qualityFlags: {
            isValidated: recordValidation.isValid,
            hasAnomalies: !recordValidation.isValid,
            anomalies: recordValidation.errors,
            confidence: recordValidation.isValid ? 1 : 0.5
          }
        });

        processedRecords.push(pollutionDataDoc);

      } catch (error) {
        processingErrors.push({
          rowNumber: record.rowNumber,
          error: error.message
        });
      }
    }

    // Save all records to database
    let savedRecords = [];
    if (processedRecords.length > 0) {
      try {
        savedRecords = await PollutionData.insertMany(processedRecords, { 
          ordered: false // Continue on error
        });
      } catch (insertError) {
        // Handle partial insert success
        if (insertError.writeErrors) {
          savedRecords = insertError.insertedDocs || [];
          insertError.writeErrors.forEach(writeError => {
            processingErrors.push({
              rowNumber: writeError.err.op?.originalData?.rowNumber || 'unknown',
              error: writeError.err.message
            });
          });
        } else {
          throw insertError;
        }
      }
    }

    // Clean up uploaded file
    await fileUploader.cleanupFile(filePath);

    // Prepare response
    const response = {
      success: true,
      message: 'File processed successfully',
      data: {
        fileInfo: {
          originalName: fileMetadata.originalName,
          size: fileMetadata.size,
          hash: fileMetadata.hash,
          processedAt: new Date()
        },
        processing: {
          totalRows: parseResult.metadata.totalRows,
          processedRows: savedRecords.length,
          errorRows: processingErrors.length,
          detectedMetals: parseResult.metadata.detectedMetals,
          metalColumns: parseResult.metadata.metalColumns
        },
        results: savedRecords.slice(0, 5).map(record => ({
          id: record._id,
          location: record.location.name,
          coordinates: record.coordinates,
          heavyMetals: Object.fromEntries(record.heavyMetals),
          hmpi: record.pollutionIndices.hmpi?.value || null,
          category: record.pollutionIndices.hmpi?.category || 'Unknown'
        }))
      }
    };

    if (processingErrors.length > 0) {
      response.warnings = {
        message: `${processingErrors.length} rows had errors`,
        errors: processingErrors.slice(0, 10) // Limit error details
      };
    }

    res.status(201).json(response);

  } catch (error) {
    // Clean up file in case of error
    try {
      await fileUploader.cleanupFile(filePath);
    } catch (cleanupError) {
      console.error('File cleanup failed:', cleanupError.message);
    }
    
    next(error);
  }
});

/**
 * @desc    Get pollution data with filtering and pagination
 * @route   GET /api/data
 * @access  Public
 */
export const getPollutionData = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    location,
    state,
    category,
    minHMPI,
    maxHMPI,
    year,
    metal,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build filter query
  const filter = {};

  if (location) {
    filter['location.name'] = { $regex: location, $options: 'i' };
  }

  if (state) {
    filter['location.state'] = { $regex: state, $options: 'i' };
  }

  if (category) {
    filter['pollutionIndices.hmpi.category'] = category;
  }

  if (minHMPI || maxHMPI) {
    filter['pollutionIndices.hmpi.value'] = {};
    if (minHMPI) filter['pollutionIndices.hmpi.value'].$gte = parseFloat(minHMPI);
    if (maxHMPI) filter['pollutionIndices.hmpi.value'].$lte = parseFloat(maxHMPI);
  }

  if (year) {
    filter['sampleInfo.year'] = parseInt(year);
  }

  if (metal) {
    filter[`heavyMetals.${metal.toUpperCase()}`] = { $exists: true };
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  try {
    // Get total count
    const totalRecords = await PollutionData.countDocuments(filter);

    // Get paginated data
    const records = await PollutionData.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-originalData -__v');

    // Calculate pagination info
    const totalPages = Math.ceil(totalRecords / parseInt(limit));

    res.status(200).json({
      success: true,
      data: records,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRecords,
        recordsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPreviousPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get single pollution data record
 * @route   GET /api/data/:id
 * @access  Public
 */
export const getPollutionDataById = asyncHandler(async (req, res, next) => {
  const record = await PollutionData.findById(req.params.id);

  if (!record) {
    return next(new AppError('Pollution data record not found', 404));
  }

  res.status(200).json({
    success: true,
    data: record
  });
});

/**
 * @desc    Get pollution statistics
 * @route   GET /api/data/stats
 * @access  Public
 */
export const getPollutionStats = asyncHandler(async (req, res, next) => {
  const { state, year } = req.query;

  // Build filter
  const filter = {};
  if (state) filter['location.state'] = { $regex: state, $options: 'i' };
  if (year) filter['sampleInfo.year'] = parseInt(year);

  try {
    // Get category distribution
    const categoryStats = await PollutionData.getPollutionStats(filter);

    // Get metal statistics
    const metalStats = await PollutionData.aggregate([
      { $match: filter },
      {
        $project: {
          heavyMetalsArray: { $objectToArray: '$heavyMetals' }
        }
      },
      { $unwind: '$heavyMetalsArray' },
      {
        $group: {
          _id: '$heavyMetalsArray.k',
          count: { $sum: 1 },
          avgValue: { $avg: '$heavyMetalsArray.v.value' },
          minValue: { $min: '$heavyMetalsArray.v.value' },
          maxValue: { $max: '$heavyMetalsArray.v.value' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get yearly trends
    const yearlyStats = await PollutionData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$sampleInfo.year',
          count: { $sum: 1 },
          avgHMPI: { $avg: '$pollutionIndices.hmpi.value' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        categoryDistribution: categoryStats,
        metalStatistics: metalStats,
        yearlyTrends: yearlyStats,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Delete pollution data record
 * @route   DELETE /api/data/:id
 * @access  Public
 */
export const deletePollutionData = asyncHandler(async (req, res, next) => {
  const record = await PollutionData.findById(req.params.id);

  if (!record) {
    return next(new AppError('Pollution data record not found', 404));
  }

  await PollutionData.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Pollution data record deleted successfully'
  });
});

export default {
  uploadPollutionData,
  getPollutionData,
  getPollutionDataById,
  getPollutionStats,
  deletePollutionData
};