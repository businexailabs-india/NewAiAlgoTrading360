# Performance Comparison Feature

## Overview
The Performance Comparison feature allows users to compare the performance of different investment strategies or portfolios over various time periods. This feature provides visual insights into how different investment options perform relative to each other.

## Features

### 1. Interactive Chart
- **Multi-line comparison**: Compare up to multiple portfolios/strategies simultaneously
- **Time-based visualization**: Shows performance trends over selected time periods
- **Interactive tooltips**: Hover over data points to see exact values
- **Smooth animations**: Enhanced user experience with motion effects

### 2. Time Range Filters
Users can select from the following time ranges:
- **1M** - 1 Month
- **6M** - 6 Months  
- **1Y** - 1 Year (default)
- **3Y** - 3 Years
- **MAX** - Maximum available data

### 3. Performance Metrics
The feature displays:
- Current value of ₹100 invested at the start of the period
- Absolute return in rupees
- Percentage return
- Visual indicators (color-coded for positive/negative returns)

### 4. Comparison Categories
Currently comparing:
- **smallcase**: Represents small-cap equity portfolios
- **Equity Large Cap**: Represents large-cap equity portfolios

## Technical Implementation

### Frontend Components

#### PerformanceComparison.tsx
Location: `src/components/PerformanceComparison.tsx`

**Key Features:**
- React component with hooks (useState, useEffect)
- Integration with Recharts for data visualization
- Responsive design with Tailwind CSS
- Motion animations using Framer Motion
- Real-time data fetching from backend API

**Props:**
```typescript
interface PerformanceComparisonProps {
  timeRange?: string; // Default: '1Y'
}
```

### Backend API

#### Endpoint
```
GET /api/portfolio/performance-comparison
```

**Query Parameters:**
- `timeRange`: String ('1M', '6M', '1Y', '3Y', 'MAX')
- `portfolioIds`: Optional array of portfolio IDs to compare

**Response Format:**
```json
{
  "success": true,
  "data": {
    "timeRange": "1Y",
    "performanceData": [
      {
        "index": 0,
        "date": "2024-01-01",
        "smallcap": 100.00,
        "largecap": 100.00
      }
    ],
    "summary": {
      "smallcap": {
        "currentValue": 118.15,
        "returnPercent": "18.15"
      },
      "largecap": {
        "currentValue": 109.16,
        "returnPercent": "9.16"
      }
    }
  }
}
```

#### Controller
Location: `backend/src/controllers/portfolio.controller.ts`

Function: `getPerformanceComparison`

#### Route
Location: `backend/src/routes/portfolio.routes.ts`

Route: `router.get('/performance-comparison', getPerformanceComparison)`

### Service Layer

#### portfolioService.ts
Location: `src/services/portfolioService.ts`

**Methods:**
- `getPerformanceComparison(timeRange)`: Fetches data from backend API
- `getMockPerformanceComparison(timeRange)`: Provides fallback mock data

## Integration

The Performance Comparison feature is integrated into the Smart Trading Dashboard as a separate tab:

**Location:** `src/components/SmartTradingDashboard.tsx`

**Tab Name:** "Comparison"

**Access:** Navigate to Smart Trading Dashboard → Comparison tab

## Usage

1. Navigate to the Smart Trading Dashboard
2. Click on the "Comparison" tab
3. Select your desired time range using the filter buttons (1M, 6M, 1Y, 3Y, MAX)
4. View the interactive chart showing performance comparison
5. Hover over the chart to see detailed values at specific points
6. Review the summary cards below the chart for current values and returns

## Styling

The component follows the application's design system:
- **Dark theme**: Gray-900/800 backgrounds
- **Accent colors**: 
  - Cyan (#06b6d4) for smallcase
  - Orange (#fb923c) for Equity Large Cap
  - Green for positive returns
  - Red for negative returns
- **Glassmorphism effects**: Backdrop blur and transparency
- **Responsive layout**: Works on all screen sizes

## Future Enhancements

Potential improvements for future versions:
1. Add more portfolio/strategy options for comparison
2. Export comparison data to CSV/PDF
3. Add benchmark indices (Nifty 50, Sensex, etc.)
4. Include risk metrics (Sharpe ratio, volatility)
5. Custom date range selection
6. Save favorite comparisons
7. Share comparison charts
8. Add annotations and notes to charts

## Dependencies

- **React**: UI framework
- **Recharts**: Chart library
- **Framer Motion**: Animation library
- **Tailwind CSS**: Styling
- **Lucide React**: Icons

## Notes

- The feature currently uses mock data for demonstration
- Real data integration requires proper authentication
- Performance data is cached for better user experience
- The component handles loading and error states gracefully
