# Bulk Upload with BullMQ Setup Guide

## Prerequisites

### 1. Install Required Dependencies

First, install the required NPM packages:

```bash
npm install bullmq ioredis @nestjs/bull
```

### 2. Redis Server

BullMQ requires Redis to be running. You can install Redis locally or use a cloud provider.

**Local Redis Installation:**
```bash
# macOS (using Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server

# Windows (using WSL or Redis for Windows)
# Follow the official Redis installation guide
```

**Cloud Redis Options:**
- Redis Cloud
- AWS ElastiCache
- Google Cloud Memorystore
- Azure Cache for Redis

### 3. Environment Variables

Add the following environment variables to your `.env` file:

```env
# Redis Configuration for BullMQ
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password  # Optional, leave empty for local development
REDIS_DB=0

# MongoDB Configuration (existing)
MONGODB_URI=your_mongodb_uri
DATABASE_NAME=your_database_name
```

## Implementation Overview

### Features Implemented

1. **Queue Management System**
   - BullMQ integration with Redis
   - Job progress tracking
   - Error handling and retries
   - Background processing

2. **Bulk Operations Support**
   - Members: Create/Update from CSV
   - First-timers: Create from CSV
   - Users: Create/Update from CSV (structure ready)

3. **Job Types**
   - `BULK_MEMBER_CREATE`
   - `BULK_MEMBER_UPDATE`
   - `BULK_FIRST_TIMER_CREATE`
   - `BULK_USER_CREATE`
   - `BULK_USER_UPDATE`

4. **API Endpoints**

#### Bulk Operations
- `POST /members/bulk-operation` - Queue member bulk operations
- `POST /first-timers/bulk-upload` - Queue first-timer bulk upload

#### Queue Management
- `GET /queue/jobs/:jobId/status` - Get job status
- `GET /queue/jobs/history` - Get user's job history
- `DELETE /queue/jobs/:jobId` - Cancel a job
- `GET /queue/stats` - Get queue statistics (admin only)

### CSV Format Examples

#### Members CSV Format
```csv
First Name,Last Name,Email,Phone,Date of Birth,Gender,Marital Status,Occupation,Street,City,State,Country,Emergency Contact Name,Emergency Contact Phone,Emergency Contact Relationship,Salvation Date,Baptism Date,Membership Date,Join Via,Previous Church,Skills,Interests,Ministry Preferences
John,Doe,john.doe@email.com,+2348012345678,1990-01-15,male,married,Engineer,123 Main St,Lagos,Lagos State,Nigeria,Jane Doe,+2348012345679,spouse,2020-01-01,2020-03-01,2020-06-01,invitation,Previous Church,programming,music,worship team
```

#### First-timers CSV Format
```csv
First Name,Last Name,Phone,Email,Date of Visit,Invited By,How Did You Hear,Previous Church,Visitor Type,Marital Status,Number of Children,Street,City,State,Country,Interests,Prayer Requests,Serving Interests,Notes
John,Doe,+2348012345678,john.doe@email.com,2024-01-15,Jane Smith,friend,Previous Church,first_time,married,2,123 Main St,Lagos,Lagos State,Nigeria,worship,healing,usher,First time visitor
```

### Job Status Response Format

```json
{
  "success": true,
  "data": {
    "status": "completed|active|waiting|failed",
    "progress": {
      "processedRows": 50,
      "totalRows": 100,
      "successCount": 48,
      "errorCount": 2,
      "currentRow": 50,
      "stage": "processing|completed|failed",
      "message": "Processing row 50 of 100"
    },
    "result": {
      "success": true,
      "processedCount": 48,
      "failedCount": 2,
      "totalCount": 50,
      "details": {
        "successfulRecords": [...],
        "failedRecords": [
          {
            "row": 25,
            "data": {...},
            "errors": ["Validation error message"]
          }
        ]
      }
    }
  }
}
```

## Usage Instructions

### 1. Start Redis Server
Ensure Redis is running before starting the application.

### 2. Upload CSV File
Use the bulk operation endpoints to upload CSV files. The API will:
- Validate the file format and size
- Parse the CSV to get row count
- Queue the job for background processing
- Return a job ID for tracking

### 3. Monitor Job Progress
Use the job ID to check processing status:
```javascript
GET /queue/jobs/{jobId}/status
```

### 4. View Job History
Get a list of recent jobs for the current user:
```javascript
GET /queue/jobs/history?limit=10
```

## Configuration Options

### Queue Settings
- **Retry Attempts**: 3 attempts with exponential backoff
- **Job Retention**: 50 completed jobs, 100 failed jobs
- **Priority System**: First-timers (10), Members (5), Users (1)

### File Limits
- **Members**: 10MB max file size
- **First-timers**: 5MB max file size
- **Format**: CSV files only

### Performance Features
- Batch processing with progress updates
- Memory-efficient CSV parsing
- Background job processing
- Real-time progress tracking
- Error handling with detailed reports

## Testing the Implementation

### 1. Basic Test
```bash
# Start the application
npm run start:dev

# Upload a small CSV file through the API
# Monitor the job progress
# Check the results
```

### 2. Load Test
```bash
# Upload larger CSV files (1000+ rows)
# Monitor queue performance
# Check Redis memory usage
```

### 3. Error Handling Test
```bash
# Upload CSV with invalid data
# Test skipErrors functionality
# Verify error reporting
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check if Redis is running
   - Verify Redis host/port configuration
   - Check firewall settings

2. **Jobs Not Processing**
   - Check Redis connection
   - Verify queue configuration
   - Check application logs

3. **Memory Issues**
   - Monitor Redis memory usage
   - Adjust job retention settings
   - Consider file size limits

4. **Performance Issues**
   - Check Redis performance
   - Monitor queue backlog
   - Consider scaling Redis

## Security Considerations

1. **File Upload Security**
   - File type validation (CSV only)
   - File size limits
   - Content validation

2. **Access Control**
   - Role-based access to bulk operations
   - User-specific job access
   - Admin-only queue statistics

3. **Data Validation**
   - Input sanitization
   - Schema validation
   - Error handling

## Monitoring and Maintenance

### Queue Health
- Monitor job completion rates
- Check error rates
- Monitor Redis memory usage
- Track processing times

### Database Impact
- Monitor database connections during bulk operations
- Check for performance impact on regular operations
- Consider indexing for bulk operations

### Logs and Alerts
- Set up logging for job failures
- Monitor queue backlogs
- Alert on Redis connection issues
- Track bulk operation metrics