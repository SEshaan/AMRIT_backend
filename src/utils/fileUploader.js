import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

/**
 * File upload utility using multer
 */
class FileUploader {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB
    this.allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || ['.xlsx', '.xls'];
    
    this.initializeUploadDir();
  }

  /**
   * Initialize upload directory
   */
  async initializeUploadDir() {
    try {
      await fs.access(this.uploadDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Generate unique filename
   */
  generateUniqueFilename(originalName) {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    return `${baseName}_${timestamp}_${randomBytes}${extension}`;
  }

  /**
   * Storage configuration for multer
   */
  getStorageConfig() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueName = this.generateUniqueFilename(file.originalname);
        cb(null, uniqueName);
      }
    });
  }

  /**
   * File filter for multer
   */
  getFileFilter() {
    return (req, file, cb) => {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (this.allowedTypes.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed types: ${this.allowedTypes.join(', ')}`), false);
      }
    };
  }

  /**
   * Get multer configuration
   */
  getMulterConfig() {
    return {
      storage: this.getStorageConfig(),
      fileFilter: this.getFileFilter(),
      limits: {
        fileSize: this.maxFileSize
      }
    };
  }

  /**
   * Create multer middleware
   */
  createUploadMiddleware(fieldName = 'file') {
    const upload = multer(this.getMulterConfig());
    return upload.single(fieldName);
  }

  /**
   * Validate uploaded file
   */
  async validateFile(file) {
    const errors = [];

    // Check if file exists
    if (!file) {
      errors.push('No file uploaded');
      return { isValid: false, errors };
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File size too large. Maximum size: ${this.maxFileSize / 1024 / 1024}MB`);
    }

    // Check file extension
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (!this.allowedTypes.includes(fileExtension)) {
      errors.push(`Invalid file type. Allowed types: ${this.allowedTypes.join(', ')}`);
    }

    // Check if file actually exists on disk
    try {
      await fs.access(file.path);
    } catch (error) {
      errors.push('Uploaded file not found on server');
    }

    // Verify file is not empty
    try {
      const stats = await fs.stat(file.path);
      if (stats.size === 0) {
        errors.push('File is empty');
      }
    } catch (error) {
      errors.push('Cannot read file statistics');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate file hash for deduplication
   */
  async generateFileHash(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      throw new Error(`Failed to generate file hash: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(file) {
    try {
      const stats = await fs.stat(file.path);
      const hash = await this.generateFileHash(file.path);

      return {
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: stats.size,
        mimeType: file.mimetype,
        extension: path.extname(file.originalname).toLowerCase(),
        uploadedAt: new Date(),
        hash
      };
    } catch (error) {
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Clean up uploaded file
   */
  async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error(`Failed to cleanup file ${filePath}:`, error.message);
      return false;
    }
  }

  /**
   * Clean up old files (older than specified days)
   */
  async cleanupOldFiles(daysOld = 30) {
    try {
      const files = await fs.readdir(this.uploadDir);
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        } catch (error) {
          console.error(`Error processing file ${file}:`, error.message);
        }
      }

      return {
        success: true,
        cleanedCount,
        message: `Cleaned up ${cleanedCount} old files`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get upload directory statistics
   */
  async getUploadStats() {
    try {
      const files = await fs.readdir(this.uploadDir);
      let totalSize = 0;
      let fileCount = 0;

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            totalSize += stats.size;
            fileCount++;
          }
        } catch (error) {
          // Skip files that can't be accessed
          continue;
        }
      }

      return {
        fileCount,
        totalSize,
        totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        uploadDir: this.uploadDir
      };

    } catch (error) {
      throw new Error(`Failed to get upload statistics: ${error.message}`);
    }
  }
}

// Create singleton instance
const fileUploader = new FileUploader();

export default fileUploader;