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
  console.log('=== Starting file upload process ===');
  
  if (!req.file) {
    console.log('❌ No file uploaded');
    return next(new AppError('No file uploaded', 400));
  }

  console.log('📁 File received:', {
    filename: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
    path: req.file.path
  });

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
    console.log('📊 Starting Excel file parsing...');
    const parser = new ExcelParser();
    const parseResult = await parser.processFile(filePath);
    
    console.log('📊 Parse result:', {
      success: parseResult.success,
      dataLength: parseResult.data?.length || 0,
      error: parseResult.error || 'none'
    });

    if (!parseResult.success) {
      console.log('❌ File parsing failed:', parseResult.error);
      await fileUploader.cleanupFile(filePath);
      return next(new AppError(`File parsing failed: ${parseResult.error}`, 400));
    }

    if (parseResult.data.length === 0) {
      console.log('❌ No valid data found in file');
      await fileUploader.cleanupFile(filePath);
      return next(new AppError('No valid data found in file', 400));
    }

    // Process each record
    console.log(`🔄 Processing ${parseResult.data.length} records...`);
    const processedRecords = [];
    const processingErrors = [];

    for (const record of parseResult.data) {
      try {
        console.log(`📝 Processing record ${record.rowNumber}:`, {
          location: record.location?.name,
          heavyMetalsCount: Object.keys(record.heavyMetals || {}).length,
          sampleHeavyMetal: Object.entries(record.heavyMetals || {})[0],
          environmentalParamsCount: Object.keys(record.environmentalParams || {}).length
        });
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

        // Calculate comprehensive pollution indices if heavy metals are present
        let pollutionIndices = {};
        if (Object.keys(heavyMetalsForCalculation).length > 0) {
          try {
            const assessment = hmpiCalculator.calculateComprehensiveAssessment(heavyMetalsForCalculation);
            
            pollutionIndices = {
              // Primary HPI
              hpi: {
                value: assessment.hpi.value,
                interpretation: assessment.hpi.interpretation,
                metalCount: assessment.hpi.metalCount,
                calculatedAt: new Date()
              },
              
              // Nemerow Pollution Index
              nemerowIndex: {
                value: assessment.nemerowIndex.value,
                interpretation: assessment.nemerowIndex.interpretation,
                maxRatio: assessment.nemerowIndex.maxRatio,
                meanRatio: assessment.nemerowIndex.meanRatio,
                calculatedAt: new Date()
              },
              
              // Pollution Load Index
              pollutionLoadIndex: {
                value: assessment.pollutionLoadIndex.value,
                interpretation: assessment.pollutionLoadIndex.interpretation,
                metalCount: assessment.pollutionLoadIndex.metalCount,
                calculatedAt: new Date()
              },
              
              // Ecological Risk Index
              ecologicalRiskIndex: {
                totalValue: assessment.ecologicalRiskIndex.totalValue,
                interpretation: assessment.ecologicalRiskIndex.interpretation,
                metalCount: assessment.ecologicalRiskIndex.metalCount,
                calculatedAt: new Date()
              },
              
              // Overall Assessment
              overallAssessment: assessment.overallAssessment,
              
              // Individual metal details
              metalAnalysis: {
                contaminationFactors: assessment.contaminationFactors,
                geoaccumulationIndex: assessment.geoaccumulationIndex,
                healthRiskIndex: assessment.healthRiskIndex
              },
              
              // Legacy HMPI for compatibility
              hmpi: {
                value: assessment.hpi.value,
                category: assessment.hpi.interpretation.level,
                metalCount: assessment.hpi.metalCount,
                calculatedAt: new Date()
              }
            };
            
          } catch (calcError) {
            console.warn(`Pollution indices calculation failed for record ${record.rowNumber}:`, calcError.message);
            pollutionIndices = {
              hmpi: {
                value: null,
                category: 'Unknown',
                calculatedAt: new Date()
              },
              error: calcError.message
            };
          }
        } else {
          pollutionIndices = {
            hmpi: {
              value: null,
              category: 'No Heavy Metals',
              calculatedAt: new Date()
            }
          };
        }

        // Create PollutionData document as plain object first
        // Filter environmental params to exclude non-environmental data and ensure proper format
        const environmentalParams = {};
        if (record.environmentalParams) {
          const validEnvParams = ['pH', 'EC', 'CO3', 'HCO3', 'Cl', 'F', 'SO4', 'NO3', 'PO4', 'Total Hardness', 'Ca', 'Mg', 'Na', 'K'];
          for (const [key, value] of Object.entries(record.environmentalParams)) {
            // Check if it's a valid environmental parameter and not metadata
            if (validEnvParams.some(param => key.toLowerCase().includes(param.toLowerCase())) && 
                typeof value === 'number' && !isNaN(value)) {
              environmentalParams[key] = {
                value: value,
                unit: key.includes('pH') ? 'pH units' : 
                      key.includes('EC') ? 'µS/cm' :
                      key.includes('Hardness') ? 'mg/L as CaCO3' : 'mg/L'
              };
            }
          }
        }

        const pollutionDataDoc = {
          location: record.location,
          coordinates: record.coordinates,
          sampleInfo: record.sampleInfo,
          heavyMetals: record.heavyMetals, // Keep as plain object initially
          environmentalParams: environmentalParams,
          pollutionIndices,
          originalData: record.originalData,
          processing: {
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
        };

        processedRecords.push(pollutionDataDoc);
        
        if (processedRecords.length <= 3) {
          console.log(`📋 Sample record ${processedRecords.length}:`, {
            location: pollutionDataDoc.location,
            coordinates: pollutionDataDoc.coordinates,
            heavyMetalsCount: Object.keys(pollutionDataDoc.heavyMetals).length,
            hmpiValue: pollutionDataDoc.pollutionIndices?.hmpi?.value
          });
        }

      } catch (error) {
        processingErrors.push({
          rowNumber: record.rowNumber,
          error: error.message
        });
      }
    }

    // Save all records to database
    console.log(`💾 Attempting to save ${processedRecords.length} records to database...`);
    
    // Test validation on first record
    if (processedRecords.length > 0) {
      console.log('🧪 Testing validation on first record...');
      try {
        const testDoc = new PollutionData(processedRecords[0]);
        await testDoc.validate();
        console.log('✅ First record validation passed');
      } catch (validationError) {
        console.log('❌ First record validation failed:', validationError.message);
        console.log('📋 Validation errors:');
        if (validationError.errors) {
          Object.keys(validationError.errors).forEach(key => {
            console.log(`  - ${key}: ${validationError.errors[key].message}`);
          });
        }
        console.log('📋 First record structure (simplified):');
        const simplified = {
          location: processedRecords[0].location,
          coordinates: processedRecords[0].coordinates,
          heavyMetalsKeys: Object.keys(processedRecords[0].heavyMetals),
          processingStatus: processedRecords[0].processing?.processingStatus
        };
        console.log(JSON.stringify(simplified, null, 2));
      }
    }
    
    let savedRecords = [];
    if (processedRecords.length > 0) {
      console.log('🔬 Detailed debugging before insert:');
      console.log('📊 processedRecords.length:', processedRecords.length);
      console.log('📊 First record keys:', Object.keys(processedRecords[0]));
      console.log('📊 First record location:', processedRecords[0].location);
      console.log('📊 First record heavyMetals:', processedRecords[0].heavyMetals);
      
      try {
        // Bulk insert all records at once
        console.log(`💾 Attempting bulk insert of ${processedRecords.length} records...`);
        
        const insertResult = await PollutionData.insertMany(processedRecords, { 
          ordered: false // Continue on error
        });
        
        savedRecords = insertResult;
        console.log(`✅ Successfully saved ${savedRecords.length} records to database`);
        console.log('📊 Sample saved record ID:', savedRecords[0]?._id);
        
        // Double-check the actual count in database
        const verifyCount = await PollutionData.countDocuments({
          'processing.fileHash': fileMetadata.hash
        });
        console.log(`🔍 Database verification: ${verifyCount} records with this file hash`);
        
      } catch (insertError) {
        console.log('❌ Database insert error:', insertError.message);
        console.log('📋 Error details:', insertError);
        
        // Handle partial insert success
        if (insertError.writeErrors) {
          savedRecords = insertError.insertedDocs || [];
          console.log(`⚠️ Partial success: ${savedRecords.length} records saved despite errors`);
          console.log('📋 First few write errors:');
          insertError.writeErrors.slice(0, 5).forEach((writeError, index) => {
            console.log(`  ${index + 1}. ${writeError.err.message}`);
            console.log(`      Code: ${writeError.err.code}`);
            console.log(`      Index: ${writeError.index}`);
          });
          
          // Log the full error for debugging
          console.log('📋 Full insertError details:');
          console.log(`  - writeErrors count: ${insertError.writeErrors.length}`);
          console.log(`  - insertedDocs count: ${insertError.insertedDocs?.length || 0}`);
          console.log(`  - nInserted: ${insertError.result?.nInserted || 'unknown'}`);
          
          // Verify actual count in database
          console.log('🔍 Verifying actual database count...');
          const actualCount = await PollutionData.countDocuments({
            'processing.fileHash': fileMetadata.hash
          });
          console.log(`📊 Actual records in database: ${actualCount}`);
          
          if (actualCount === 0) {
            console.log('❌ CRITICAL: No records actually saved despite insertedDocs reporting success');
            console.log('🔍 Attempting single record insertion to diagnose...');
            
            try {
              // Try to save just the first record to see what the real error is
              const testRecord = await PollutionData.create(processedRecords[0]);
              console.log('✅ Single record save successful:', testRecord._id);
              
              // If single save works, try smaller batches
              console.log('🔄 Attempting batch insertion with smaller chunks...');
              const batchSize = 100;
              const batches = [];
              
              for (let i = 0; i < processedRecords.length; i += batchSize) {
                batches.push(processedRecords.slice(i, i + batchSize));
              }
              
              console.log(`📦 Split into ${batches.length} batches of ${batchSize} records each`);
              
              let totalSaved = 0;
              for (let i = 0; i < batches.length; i++) { // Process all batches
                try {
                  const batchResult = await PollutionData.insertMany(batches[i], { ordered: false });
                  totalSaved += batchResult.length;
                  console.log(`✅ Batch ${i + 1}: ${batchResult.length} records saved`);
                } catch (batchError) {
                  console.log(`⚠️ Batch ${i + 1} had errors: ${batchError.message}`);
                  if (batchError.insertedDocs) {
                    totalSaved += batchError.insertedDocs.length;
                  }
                }
              }
              
              savedRecords = [testRecord]; // At least we have one record
              console.log(`🎯 Batch insertion test: ${totalSaved} records saved from first 3 batches`);
              
            } catch (singleError) {
              console.log('❌ Single record save also failed:', singleError.message);
              console.log('📋 Single record error details:', singleError);
              
              // Let's examine the actual record structure
              console.log('🔍 Examining problematic record structure:');
              console.log('📋 Keys:', Object.keys(processedRecords[0]));
              console.log('📋 Location:', processedRecords[0].location);
              console.log('📋 Heavy metals type:', typeof processedRecords[0].heavyMetals);
              console.log('📋 Environmental params type:', typeof processedRecords[0].environmentalParams);
              console.log('📋 Pollution indices:', processedRecords[0].pollutionIndices);
            }
          } else {
            // Query some records to confirm they exist
            const sampleRecords = await PollutionData.find({
              'processing.fileHash': fileMetadata.hash
            }).limit(5);
            savedRecords = sampleRecords;
            console.log(`✅ Found ${actualCount} records in database, using sample for response`);
          }
        } else if (insertError.insertedDocs) {
          savedRecords = insertError.insertedDocs;
          console.log(`⚠️ Partial success: ${savedRecords.length} records saved`);
        } else {
          // Try one record at a time to identify the issue
          console.log('🔍 Trying single record insertion to identify issue...');
          try {
            const singleRecord = await PollutionData.create(processedRecords[0]);
            console.log('✅ Single record save successful:', singleRecord._id);
            savedRecords = [singleRecord];
          } catch (singleError) {
            console.log('❌ Single record save also failed:', singleError.message);
            throw insertError; // Re-throw original error
          }
        }
      }
    } else {
      console.log('⚠️ No records to save to database');
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
  const {
    state,
    year,
    ne_lat,
    ne_lng,
    sw_lat,
    sw_lng,
    margin = 0
  } = req.query;

  // Build filter
  const filter = {};
  if (state) filter['location.state'] = { $regex: state, $options: 'i' };
  if (year) filter['sampleInfo.year'] = parseInt(year);

  // Handle bounding box filtering if coordinates are provided
  if (ne_lat && ne_lng && sw_lat && sw_lng) {
    const northEast = [parseFloat(ne_lng) + parseFloat(margin), parseFloat(ne_lat) + parseFloat(margin)];
    const southWest = [parseFloat(sw_lng) - parseFloat(margin), parseFloat(sw_lat) - parseFloat(margin)];

    filter.coordinates = {
      $geoWithin: {
        $box: [southWest, northEast]
      }
    };
  }

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

/**
 * @desc    Get related data for a specific data point by its ID
 * @route   GET /api/data/heatmap/:id
 * @access  Public
 */
export const getRelatedDataById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Find the data point by its ID and return all its details.
  // The 'lean()' method returns a plain JavaScript object for better performance,
  // as we don't need Mongoose's change tracking or methods here.
  const record = await PollutionData.findById(id).lean();

  if (!record) {
    return next(new AppError('Pollution data record not found', 404));
  }

  res.status(200).json({
    success: true,
    data: record
  });
});

/**
 * Helper function to build dynamic filters for metals and environmental parameters.
 * It parses query objects like:
 * metals[Fe][min]=1.0&metals[Fe][max]=5.0
 * env[pH][min]=6.5
 * @param {object} queryParams - The req.query object.
 * @returns {object} A MongoDB filter object.
 */
const buildDynamicFilters = (queryParams) => {
  const filter = {};
  const { metals, env } = queryParams;

  // Handle heavy metal filters
  if (metals && typeof metals === 'object') {
    for (const [metal, conditions] of Object.entries(metals)) {
      const key = `heavyMetals.${metal.toUpperCase()}.value`;
      filter[key] = {};
      if (conditions.min) filter[key].$gte = parseFloat(conditions.min);
      if (conditions.max) filter[key].$lte = parseFloat(conditions.max);
    }
  }

  // Handle environmental parameter filters
  if (env && typeof env === 'object') {
    for (const [param, conditions] of Object.entries(env)) {
      // The key needs to match exactly how it's stored in the DB.
      const key = `environmentalParams.${param}.value`;
      filter[key] = {};
      if (conditions.min) filter[key].$gte = parseFloat(conditions.min);
      if (conditions.max) filter[key].$lte = parseFloat(conditions.max);
    }
  }

  return filter;
};
/**
 * @desc    Get data for heatmap visualization
 * @route   GET /api/data/heatmap
 * @access  Public
 */
export const getHeatmapData = asyncHandler(async (req, res, next) => {
  const {
    metric = 'hmpi', // 'hmpi' or a specific metal like 'Fe'
    year,
    state,
    category,
    ne_lat, ne_lng, sw_lat, sw_lng,
    margin = 0.1, // Default margin of ~11km
    aggregate,
    agg_lat = 0.1, // Latitude degrees for aggregation grid
    agg_lng = 0.1  // Longitude degrees for aggregation grid
  } = req.query;

  // Build filter query
  let filter = { 'processing.processingStatus': 'processed' };

  // Handle bounding box filtering if coordinates are provided
  if (ne_lat && ne_lng && sw_lat && sw_lng) {
    const northEast = [parseFloat(ne_lng) + parseFloat(margin), parseFloat(ne_lat) + parseFloat(margin)];
    const southWest = [parseFloat(sw_lng) - parseFloat(margin), parseFloat(sw_lat) - parseFloat(margin)];

    filter.coordinates = {
      $geoWithin: {
        $box: [
          southWest, // bottom-left
          northEast  // top-right
        ]
      }
    };
  }
  if (year) {
    filter['sampleInfo.year'] = parseInt(year);
  }
  if (state) {
    filter['location.state'] = { $regex: state, $options: 'i' };
  }
  if (category) {
    filter['pollutionIndices.hmpi.category'] = category;
  }

  // Add filter for the selected metric
  if (metric.toLowerCase() === 'hmpi') {
    filter['pollutionIndices.hmpi.value'] = { $exists: true, $ne: null };
  } else {
    // Assumes metric is a metal symbol, e.g., 'Fe'
    filter[`heavyMetals.${metric.toUpperCase()}`] = { $exists: true };
  }

  // Build and merge dynamic filters for metals and env params
  const dynamicFilters = buildDynamicFilters(req.query);
  filter = { ...filter, ...dynamicFilters };

  if (aggregate === 'true') {
    // --- AGGREGATED DATA PIPELINE ---
    // Returns a simple array of [lng, lat, value] for high-performance heatmaps.
    const LATITUDE_WIDTH_CONST = parseFloat(agg_lat);
    const LONGITUDE_WIDTH_CONST = parseFloat(agg_lng);

    const valueExpression = metric.toLowerCase() === 'hmpi'
      ? '$pollutionIndices.hmpi.value'
      : `$heavyMetals.${metric.toUpperCase()}.value`;

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: {
            // Group by a grid defined by the constants
            lng: {
              $multiply: [
                { $floor: { $divide: [{ $arrayElemAt: ['$coordinates.coordinates', 0] }, LONGITUDE_WIDTH_CONST] } },
                LONGITUDE_WIDTH_CONST
              ]
            },
            lat: {
              $multiply: [
                { $floor: { $divide: [{ $arrayElemAt: ['$coordinates.coordinates', 1] }, LATITUDE_WIDTH_CONST] } },
                LATITUDE_WIDTH_CONST
              ]
            }
          },
          // Calculate the average value for the metric in each grid cell
          avgValue: { $avg: valueExpression }
        }
      },
      {
        $project: {
          _id: 0, // Exclude the default _id
          type: { $literal: 'Feature' },
          geometry: {
            type: { $literal: 'Point' },
            // Center the coordinate in the middle of the grid cell
            coordinates: [
              { $add: ['$_id.lng', LONGITUDE_WIDTH_CONST / 2] },
              { $add: ['$_id.lat', LATITUDE_WIDTH_CONST / 2] }
            ]
          },
          properties: {
            value: '$avgValue',
            category: { $literal: 'Aggregated' },
            point_count: '$pointCount'
          }
        }
      }
    ];

    const aggregatedFeatures = await PollutionData.aggregate(pipeline);

    res.status(200).json({
      type: 'FeatureCollection',
      features: aggregatedFeatures
    });

  } else {
    // --- DETAILED GEOJSON PIPELINE (existing behavior) ---
    const pipeline = [
      { $match: filter },
      {
        $project: {
          _id: '$_id',
          type: { $literal: 'Feature' },
          geometry: '$coordinates',
          properties: {
            location: '$location.name',
            value: metric.toLowerCase() === 'hmpi' ? '$pollutionIndices.hmpi.value' : { $ifNull: [`$heavyMetals.${metric.toUpperCase()}.value`, null] },
            category: '$pollutionIndices.hmpi.category',
          }
        }
      },
      { $limit: 2000 } // Limit for performance
    ];

    const features = await PollutionData.aggregate(pipeline);

    res.status(200).json({
      type: 'FeatureCollection',
      features
    });
  }
});
