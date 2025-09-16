import mongoose from 'mongoose';
import { initializeAllConfigurations } from './initialData.js';

/**
 * Database connection configuration
 */
class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    try {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hmpi-database';
      
      const options = {
        // Connection options
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        
        // Authentication options (if needed)
        // authSource: 'admin',
        
        // SSL options (for production)
        // ssl: process.env.NODE_ENV === 'production',
        
        // Compression
        compressors: 'zlib',
      };

      console.log('Connecting to MongoDB...');
      await mongoose.connect(uri, options);
      
      this.isConnected = true;
      this.retryCount = 0;
      
      console.log(`✅ MongoDB connected successfully to: ${uri}`);
      
      // Clean up problematic geospatial index if it exists
      await this.cleanupProblematicIndexes();
      
      // Initialize configurations after successful connection
      if (process.env.INIT_CONFIG !== 'false') {
        await this.initializeConfigurations();
      }
      
      return true;
      
    } catch (error) {
      this.isConnected = false;
      console.error('❌ MongoDB connection error:', error.message);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying connection in ${this.retryDelay / 1000} seconds... (Attempt ${this.retryCount}/${this.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      } else {
        console.error('Max connection retries reached. Exiting...');
        process.exit(1);
      }
    }
  }

  /**
   * Initialize configuration data
   */
  async initializeConfigurations() {
    try {
      console.log('Checking and initializing configuration data...');
      const result = await initializeAllConfigurations();
      
      if (result.success) {
        console.log('✅ Configuration data initialized successfully');
      } else {
        console.warn('⚠️ Configuration initialization had issues:', result.error);
      }
    } catch (error) {
      console.error('❌ Configuration initialization failed:', error.message);
    }
  }

  /**
   * Clean up problematic indexes that conflict with current schema
   */
  async cleanupProblematicIndexes() {
    try {
      console.log('🧹 Checking for problematic geospatial indexes...');
      
      // Get the PollutionData collection
      const db = mongoose.connection.db;
      const collection = db.collection('pollutiondatas');
      
      // Get all indexes
      const indexes = await collection.indexes();
      
      // Look for problematic 2dsphere index on coordinates
      const problematicIndex = indexes.find(index => 
        index.key && index.key.coordinates === '2dsphere'
      );
      
      if (problematicIndex) {
        console.log('🔧 Found problematic 2dsphere index, dropping it...');
        await collection.dropIndex('coordinates_2dsphere');
        console.log('✅ Problematic geospatial index removed');
      } else {
        console.log('✅ No problematic geospatial indexes found');
      }
    } catch (error) {
      if (error.message.includes('index not found')) {
        console.log('✅ No problematic geospatial indexes to remove');
      } else {
        console.warn('⚠️ Error cleaning up indexes:', error.message);
      }
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('📤 MongoDB disconnected successfully');
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error.message);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }

  /**
   * Setup connection event listeners
   */
  setupEventListeners() {
    // Connection events
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      console.log('🔗 Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (error) => {
      this.isConnected = false;
      console.error('❌ Mongoose connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      console.log('📤 Mongoose disconnected from MongoDB');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, closing MongoDB connection...');
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, closing MongoDB connection...');
      await this.disconnect();
      process.exit(0);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('💥 Unhandled Promise Rejection:', err);
      console.log('🛑 Shutting down server...');
      this.disconnect();
      process.exit(1);
    });
  }

  /**
   * Health check for database connection
   */
  async healthCheck() {
    try {
      if (mongoose.connection.readyState === 1) {
        // Try a simple operation
        await mongoose.connection.db.admin().ping();
        return {
          status: 'healthy',
          connected: true,
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name,
          timestamp: new Date()
        };
      } else {
        return {
          status: 'unhealthy',
          connected: false,
          readyState: mongoose.connection.readyState,
          timestamp: new Date()
        };
      }
    } catch (error) {
      return {
        status: 'error',
        connected: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

// Setup event listeners
dbConnection.setupEventListeners();

export default dbConnection;