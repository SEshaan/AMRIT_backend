import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// ES6 module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import configurations and middleware
import dbConnection from './src/config/database.js';
import {
  globalErrorHandler,
  notFoundHandler,
  handleUnhandledRejections,
  handleUncaughtExceptions
} from './src/middleware/errorHandler.js';

// Import routes
import dataRoutes from './src/routes/dataRoutes.js';

// Handle uncaught exceptions and unhandled rejections
handleUncaughtExceptions();
handleUnhandledRejections();

/**
 * Express server setup
 */
class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 5000;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // CORS configuration
    const corsOptions = {
      origin: function (origin, callback) {
        const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
        
        // Allow requests with no origin (mobile apps, postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    };

    this.app.use(cors(corsOptions));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware (development only)
    if (process.env.NODE_ENV === 'development') {
      this.app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
      });
    }

    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      const dbHealth = await dbConnection.healthCheck();
      
      res.status(dbHealth.connected ? 200 : 503).json({
        success: true,
        status: dbHealth.connected ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: dbHealth,
        uptime: process.uptime()
      });
    });

    // API info endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        success: true,
        message: 'HMPI Backend API',
        version: '1.0.0',
        documentation: '/api/docs',
        endpoints: {
          data: '/api/data',
          health: '/health'
        },
        timestamp: new Date()
      });
    });
  }

  /**
   * Setup routes
   */
  setupRoutes() {
    // API routes
    this.app.use('/api/data', dataRoutes);

    // API Documentation endpoint
    this.app.get('/api/docs', (req, res) => {
      res.json({
        success: true,
        title: 'HMPI Backend API Documentation',
        version: '1.0.0',
        description: 'Heavy Metal Pollution Index (HMPI) Backend System for processing and analyzing environmental pollution data',
        baseUrl: `${req.protocol}://${req.get('host')}`,
        endpoints: {
          health: {
            url: '/health',
            method: 'GET',
            description: 'Check server health and database connection status'
          },
          apiInfo: {
            url: '/api',
            method: 'GET',
            description: 'Get API information and available endpoints'
          },
          uploadData: {
            url: '/api/data/upload',
            method: 'POST',
            description: 'Upload and process Excel file with pollution data',
            contentType: 'multipart/form-data',
            parameters: {
              file: 'Excel file (.xlsx or .xls) containing pollution data'
            }
          },
          getData: {
            url: '/api/data',
            method: 'GET',
            description: 'Get pollution data with optional filters and pagination',
            parameters: {
              page: 'Page number (default: 1)',
              limit: 'Records per page (default: 10)',
              location: 'Filter by location name',
              state: 'Filter by state',
              category: 'Filter by pollution category (Safe/Mid/Unsafe)',
              minHMPI: 'Minimum HMPI value',
              maxHMPI: 'Maximum HMPI value',
              year: 'Filter by sample year',
              metal: 'Filter by specific metal presence',
              sortBy: 'Sort field (default: createdAt)',
              sortOrder: 'Sort order: asc/desc (default: desc)'
            }
          },
          getDataById: {
            url: '/api/data/:id',
            method: 'GET',
            description: 'Get specific pollution data record by ID'
          },
          getStats: {
            url: '/api/data/stats',
            method: 'GET',
            description: 'Get pollution statistics and analysis',
            parameters: {
              state: 'Filter statistics by state',
              year: 'Filter statistics by year',
              ne_lat: 'North-East corner latitude of the map bounding box.',
              ne_lng: 'North-East corner longitude of the map bounding box.',
              sw_lat: 'South-West corner latitude of the map bounding box.',
              sw_lng: 'South-West corner longitude of the map bounding box.',
              margin: 'Decimal degree margin to add to the bounding box (default: 0).'
            }
          },
          deleteData: {
            url: '/api/data/:id',
            method: 'DELETE',
            description: 'Delete pollution data record by ID'
          },
          getHeatmapData: {
            url: '/api/data/heatmap',
            method: 'GET',
            description: 'Get GeoJSON data for heatmap visualization, with optional filters.',
            parameters: {
              metric: 'Metric to use for heatmap intensity (default: hmpi). Can be a metal symbol like "Fe".',
              year: 'Filter by sample year.',
              state: 'Filter by state.',
              category: 'Filter by pollution category (Safe/Mid/Unsafe).',
              ne_lat: 'North-East corner latitude of the map bounding box.',
              ne_lng: 'North-East corner longitude of the map bounding box.',
              sw_lat: 'South-West corner latitude of the map bounding box.',
              sw_lng: 'South-West corner longitude of the map bounding box.',
              margin: 'Decimal degree margin to add to the bounding box (default: 0.1).',              
              aggregate: 'Set to "true" to enable grid-based aggregation for performance.',
              agg_lat: 'Grid cell height in latitude degrees for aggregation (default: 0.1).',              
              agg_lng: 'Grid cell width in longitude degrees for aggregation (default: 0.1).',
              'metals[<symbol>][min]': 'Minimum value for a specific heavy metal (e.g., metals[Fe][min]=1.0).',
              'metals[<symbol>][max]': 'Maximum value for a specific heavy metal (e.g., metals[As][max]=50).',
              'env[<param>][min]': 'Minimum value for an environmental parameter (e.g., env[pH][min]=6.5).',
              'env[<param>][max]': 'Maximum value for an environmental parameter (e.g., env[pH][max]=8.5).'
            },
            response: 'A GeoJSON FeatureCollection. If aggregate=true, each feature represents a grid cell with an `_id`, an averaged `value`, a `point_count`, and a `category` of "Aggregated".',
            note: 'The endpoint is limited to 2000 records for performance.'
          }
        },
        sampleExcelFormat: {
          description: 'Expected Excel file format with columns:',
          requiredColumns: ['S. No.', 'State', 'District', 'Location', 'Longitude', 'Latitude', 'Year'],
          metalColumns: 'Heavy metal columns like "Fe (ppm)", "As (ppb)", etc.',
          example: {
            'S. No.': 1,
            'State': 'Punjab',
            'District': 'Gurdaspur', 
            'Location': 'Shahpur Goraya',
            'Longitude': 75.0943,
            'Latitude': 32.0266,
            'Year': 2023,
            'Fe (ppm)': 2.24,
            'As (ppb)': 23.20,
            'U (ppb)': 3.22
          }
        },
        responseFormat: {
          success: 'Boolean indicating success/failure',
          data: 'Response data (varies by endpoint)',
          message: 'Human-readable message',
          error: 'Error details (only on failure)'
        },
        timestamp: new Date()
      });
    });

    // Serve uploaded files (with authentication check)
    this.app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

    // Serve static files for documentation (if needed)
    this.app.use('/docs', express.static(path.join(__dirname, 'docs')));

    // Handle favicon requests to prevent 404 errors
    this.app.get('/favicon.ico', (req, res) => {
      res.status(204).end(); // No content
    });

    // Default route
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Welcome to HMPI Backend API',
        version: '1.0.0',
        documentation: '/api/docs',
        health: '/health',
        timestamp: new Date()
      });
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(globalErrorHandler);
  }

  /**
   * Start the server
   */
  async start() {
    try {
      // Connect to database first
      await dbConnection.connect();

      // Start server
      const server = this.app.listen(this.port, () => {
        console.log(`🚀 Server running on port ${this.port}`);
        console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Health check: http://localhost:${this.port}/health`);
        console.log(`📋 API info: http://localhost:${this.port}/api`);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔧 Development mode - detailed logging enabled`);
        }
      });

      // Graceful shutdown
      const gracefulShutdown = async (signal) => {
        console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
        
        server.close(async () => {
          console.log('📤 HTTP server closed');
          
          try {
            await dbConnection.disconnect();
            console.log('✅ Graceful shutdown completed');
            process.exit(0);
          } catch (error) {
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
          }
        });

        // Force close after 10 seconds
        setTimeout(() => {
          console.error('⏰ Forced shutdown after timeout');
          process.exit(1);
        }, 10000);
      };

      // Handle shutdown signals
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

      return server;

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Get Express app instance
   */
  getApp() {
    return this.app;
  }
}

// Create and start server
const server = new Server();

// Start the server
server.start().catch(console.error);

export default server;