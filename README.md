# HMPI Backend System Documentation

## Overview

The Heavy Metal Pollution Index (HMPI) Backend System is a comprehensive Node.js application designed to process, analyze, and manage environmental pollution data. Scientists can upload Excel files containing pollution measurements, and the system automatically calculates pollution indices and categorizes environmental risk levels.

## Features

- **Excel File Processing**: Automatic parsing of .xlsx and .xls files
- **Dynamic Heavy Metal Detection**: Intelligent column detection for various heavy metals
- **HMPI Calculation**: Configurable pollution index calculations using WHO standards
- **Flexible Data Model**: Accommodates different file formats and new metals
- **Risk Assessment**: Automated categorization (Safe/Mid/Unsafe)
- **RESTful API**: Clean API endpoints for data management
- **No Authentication Required**: Simple access for easier testing and development

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI and other settings
   ```

3. **Start MongoDB service** (ensure MongoDB is running)

4. **Run the server**:
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Test the API**:
   - Health check: `http://localhost:5000/health`
   - API info: `http://localhost:5000/api`

## API Endpoints

### Data Management
- `POST /api/data/upload` - Upload and process Excel file
- `GET /api/data` - Get pollution data (with filters)
- `GET /api/data/stats` - Get pollution statistics  
- `GET /api/data/:id` - Get specific record
- `DELETE /api/data/:id` - Delete record

## Sample Excel Format

| S. No. | State | District | Location | Longitude | Latitude | Year | Fe (ppm) | As (ppb) | U (ppb) |
|--------|-------|----------|----------|-----------|----------|------|----------|----------|---------|
| 1 | Punjab | Gurdaspur | Shahpur Goraya | 75.0943 | 32.0266 | 2023 | 2.24 | 23.20 | 3.22 |

## Expected Output

```json
{
  "location": "Shahpur Goraya",
  "coordinates": { "lat": 32.0266, "lon": 75.0943 },
  "values": {
    "Fe": 2.24,
    "As": 23.20,
    "U": 3.22
  },
  "hmpi": 28.66,
  "category": "Safe"
}
```

## Testing with Postman

1. **Upload a file directly** (no authentication needed):
   ```
   POST http://localhost:5000/api/data/upload
   Body: form-data with key 'file' and select your Excel file
   ```

2. **Get pollution data**:
   ```
   GET http://localhost:5000/api/data
   ```

3. **Get statistics**:
   ```
   GET http://localhost:5000/api/data/stats
   ```

## Heavy Metal Standards (WHO Guidelines)

| Metal | Standard | Unit |
|-------|----------|------|
| Fe | 0.3 | ppm |
| As | 10 | ppb |
| U | 15 | ppb |
| Pb | 10 | ppb |
| Hg | 6 | ppb |
| Cd | 3 | ppb |
| Cr | 50 | ppb |
| Ni | 70 | ppb |
| Zn | 3 | ppm |
| Cu | 2 | ppm |
| Mn | 0.4 | ppm |

## Project Structure

```
├── server.js                 # Main server file
├── src/
│   ├── models/               # Database models
│   ├── controllers/          # Business logic
│   ├── routes/               # API routes
│   ├── middleware/           # Express middleware
│   ├── utils/                # Utility functions
│   └── config/               # Configuration files
├── uploads/                  # File upload directory
└── .env                     # Environment variables
```

## Environment Variables

Key variables in `.env`:
- `MONGODB_URI`: MongoDB connection string
- `PORT`: Server port (default: 5000)
- `UPLOAD_DIR`: File upload directory
- `HEAVY_METALS`: Comma-separated list of metals to detect
- `UPLOAD_DIR`: File upload directory
- `HEAVY_METALS`: Comma-separated list of metals to detect

For complete documentation and troubleshooting, see the full README in the repository.
