import React, { useEffect, useState, useRef, useCallback } from "react";
import { Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { WiThermometer, WiDaySunny, WiRain, WiSnow, WiCloud } from "react-icons/wi";
import { FaTint, FaMoon, FaSun, FaWifi, FaWifiSlash, FaUpload } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import { FiWifiOff } from "react-icons/fi";
import FirmwareUpdate from "./FirmwareUpdate";
import axios from "axios";
import DataTable from 'react-data-table-component';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const linearRegression = (x, y) => {
  const n = y.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
};

const calculateComfortIndex = (temp, humidity) => {
  if (temp === null || humidity === null) return null;
  
  // Calculate Temperature-Humidity Index (THI)
  const thi = temp - (0.55 * (1 - (humidity / 100)) * (temp - 14.5));
  
  // Determine comfort level based on THI
  if (thi < 15) return { level: "Very Cold", color: "bg-blue-500/70", icon: <WiSnow className="text-4xl text-blue-500" />, desc: "Uncomfortably cold", textColor: "text-blue-100", value: thi.toFixed(1) };
  if (thi >= 15 && thi < 20) return { level: "Cool", color: "bg-blue-400/70", icon: <WiCloud className="text-4xl text-blue-400" />, desc: "Slightly cool", textColor: "text-blue-100", value: thi.toFixed(1) };
  if (thi >= 20 && thi < 26) return { level: "Comfortable", color: "bg-green-500/70", icon: <WiDaySunny className="text-4xl text-green-500" />, desc: "Perfect comfort", textColor: "text-green-100", value: thi.toFixed(1) };
  if (thi >= 26 && thi < 30) return { level: "Warm", color: "bg-yellow-500/70", icon: <WiDaySunny className="text-4xl text-yellow-500" />, desc: "Slightly warm", textColor: "text-yellow-100", value: thi.toFixed(1) };
  if (thi >= 30 && thi < 35) return { level: "Hot", color: "bg-orange-500/70", icon: <WiDaySunny className="text-4xl text-orange-500" />, desc: "Uncomfortably hot", textColor: "text-orange-100", value: thi.toFixed(1) };
  return { level: "Very Hot", color: "bg-red-500/70", icon: <WiDaySunny className="text-4xl text-red-500" />, desc: "Dangerously hot", textColor: "text-red-100", value: thi.toFixed(1) };
};

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);
  const [time, setTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [showForecast, setShowForecast] = useState(false);
  const [forecastData, setForecastData] = useState({ temp: [], humidity: [] });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [showFirmwareUpdate, setShowFirmwareUpdate] = useState(false);
  const [firmwareVersion, setFirmwareVersion] = useState(null);
  const dashboardRef = useRef(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hoveredData, setHoveredData] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [activeTab, setActiveTab] = useState('temperature');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const login = async (username, password) => {
    try {
      const response = await axios.post('http://localhost:5000/api/data/login', 
        { username, password },
        { 
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true
        }
      );
      if (response.data.accessToken) {
        localStorage.setItem('accessToken', response.data.accessToken);
        setIsLoggedIn(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const ESP32_API_URL = "http://localhost:5000/api/data";

  const themeConfig = {
    dark: {
      bg: 'from-gray-900 to-gray-800',
      particleColor: '#4f46e5',
      icon: <FaMoon className="text-yellow-200" />,
      text: 'text-white',
      textMuted: 'text-white/80',
      cardBg: 'bg-white/10',
      border: 'border-white/20',
      chartGrid: 'rgba(255,255,255,0.1)',
      chartText: 'rgba(255,255,255,0.8)',
      accent: 'bg-indigo-500',
      accentText: 'text-indigo-200'
    },
    light: {
      bg: 'from-blue-50 to-gray-50',
      particleColor: '#3b82f6',
      icon: <FaSun className="text-yellow-500" />,
      text: 'text-gray-800',
      textMuted: 'text-gray-600',
      cardBg: 'bg-black/10',
      border: 'border-black/20',
      chartGrid: 'rgba(0,0,0,0.05)',
      chartText: 'rgba(55,65,81,0.8)',
      accent: 'bg-blue-500',
      accentText: 'text-blue-200'
    }
  };

  const timeRangeOptions = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
  ];

  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine);
  }, [isDarkMode]);

  const fetchData = async () => {
    try {
      const response = await fetch(`${ESP32_API_URL}/`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const dataArray = await response.json();
      
      if (!Array.isArray(dataArray)) {
        throw new Error('Invalid data format received');
      }
  
      // Convert timestamps to Date objects and ensure they're valid
      const processedData = dataArray.map(item => {
        const timestamp = new Date(item.timestamp);
        if (isNaN(timestamp.getTime())) {
          throw new Error('Invalid timestamp received');
        }
        return {
          ...item,
          timestamp
        };
      });
  
      setData(processedData);
      setIsConnected(true);
      setIsLoading(false);
    } catch (error) {
      console.error("Fetch error:", error);
      setIsConnected(false);
      setIsLoading(false);
      
      if (error.message.includes('Failed to fetch')) {
        setTimeout(fetchData, 5000);
      }
    }
  };

  const checkFirmwareVersion = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${ESP32_API_URL}/firmware/latest`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.data && response.data.version) {
        setFirmwareVersion(response.data.version);
      }
    } catch (error) {
      console.error("Failed to check firmware version:", error);
    }
  };

  const generateForecast = (currentData) => {
    if (currentData.length < 2) return { temp: [], humidity: [] };
    
    const x = currentData.map((_, i) => i);
    const yTemp = currentData.map(d => d.temperature);
    const yHumidity = currentData.map(d => d.humidity);
    
    const tempReg = linearRegression(x, yTemp);
    const humidityReg = linearRegression(x, yHumidity);
    
    const forecast = {
      temp: [],
      humidity: []
    };
    
    for (let i = 0; i < 12; i++) {
      const nextX = x.length + i;
      forecast.temp.push(tempReg.slope * nextX + tempReg.intercept);
      forecast.humidity.push(humidityReg.slope * nextX + humidityReg.intercept);
    }
    
    return forecast;
  };

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch(`${ESP32_API_URL}/history?range=${timeRange}`);
      if (!response.ok) throw new Error('Network error');
      const historyData = await response.json();
      
      if (!Array.isArray(historyData)) {
        throw new Error('Invalid data format received');
      }
      
      const formattedData = historyData.map(item => ({
        timestamp: item.timestamp || new Date().toISOString(),
        temperature: parseFloat(item.temperature) || 0,
        humidity: parseFloat(item.humidity) || 0
      }));
      
      setHistoricalData(formattedData);
    } catch (error) {
      console.error("Fetch error:", error);
      setHistoricalData([]);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  useEffect(() => {
    fetchHistoricalData();
  }, [timeRange]);

  useEffect(() => {
    if (data.length > 1) {
      setForecastData(generateForecast(data));
    }
  }, [data]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const prepareChartData = (baseData, forecast, showForecast) => {
    if (!baseData || baseData.length === 0) {
      return {
        labels: [],
        datasets: [
          {
            label: "Temperature (°C)",
            data: [],
            borderColor: "#f97316",
            backgroundColor: "rgba(249, 115, 22, 0.3)",
            borderWidth: 3
          },
          {
            label: "Humidity (%)",
            data: [],
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.3)",
            borderWidth: 3
          }
        ]
      };
    }
  
    // Create a map to store the latest value for each minute
    const minuteDataMap = new Map();
    
    // Process data in reverse to keep the latest value for each minute
    [...baseData].reverse().forEach(item => {
      const timestamp = new Date(item.timestamp);
      // Round to the nearest minute to group by minute
      const minuteKey = new Date(
        timestamp.getFullYear(),
        timestamp.getMonth(),
        timestamp.getDate(),
        timestamp.getHours(),
        timestamp.getMinutes()
      ).getTime();
      
      if (!minuteDataMap.has(minuteKey)) {
        minuteDataMap.set(minuteKey, {
          timestamp: new Date(minuteKey),
          temperature: item.temperature,
          humidity: item.humidity
        });
      }
    });
  
    // Convert back to array and sort chronologically
    const uniqueData = Array.from(minuteDataMap.values())
      .sort((a, b) => a.timestamp - b.timestamp);
  
    // Get only the last 30 minutes of data
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentData = uniqueData.filter(d => d.timestamp > thirtyMinutesAgo);
  
    // Create labels with proper time formatting
    const baseLabels = recentData.map(d => 
      d.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  
    // Prepare forecast labels if needed
    const forecastLabels = showForecast ? 
      Array.from({ length: forecast.temp.length }, (_, i) => {
        const date = new Date();
        date.setMinutes(date.getMinutes() + i * 5); // Forecast every 5 minutes
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }) : 
      [];
  
    return {
      labels: [...baseLabels, ...forecastLabels],
      datasets: [
        {
          label: "Temperature (°C)",
          data: [
            ...recentData.map(d => d.temperature),
            ...(showForecast ? forecast.temp : [])
          ],
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.3)",
          borderWidth: 3,
          pointRadius: (ctx) => showForecast && ctx.dataIndex >= recentData.length ? 6 : 3,
          pointBackgroundColor: (ctx) => showForecast && ctx.dataIndex >= recentData.length ? "#fff" : "#f97316",
          pointBorderColor: (ctx) => showForecast && ctx.dataIndex >= recentData.length ? "#f97316" : "#fff",
          pointHoverRadius: 6,
          pointHoverBorderWidth: 2,
          pointStyle: (ctx) => showForecast && ctx.dataIndex >= recentData.length ? 'triangle' : 'circle',
          fill: true,
          tension: 0.3,
          yAxisID: 'y',
          segment: {
            borderDash: (ctx) => showForecast && ctx.p1DataIndex >= recentData.length ? [6, 6] : undefined
          }
        },
        {
          label: "Humidity (%)",
          data: [
            ...recentData.map(d => d.humidity),
            ...(showForecast ? forecast.humidity : [])
          ],
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.3)",
          borderWidth: 3,
          pointRadius: (ctx) => showForecast && ctx.dataIndex >= recentData.length ? 6 : 3,
          pointBackgroundColor: (ctx) => showForecast && ctx.dataIndex >= recentData.length ? "#fff" : "#3b82f6",
          pointBorderColor: (ctx) => showForecast && ctx.dataIndex >= recentData.length ? "#3b82f6" : "#fff",
          pointHoverRadius: 6,
          pointHoverBorderWidth: 2,
          pointStyle: (ctx) => showForecast && ctx.dataIndex >= recentData.length ? 'triangle' : 'circle',
          fill: true,
          tension: 0.3,
          yAxisID: 'y1',
          segment: {
            borderDash: (ctx) => showForecast && ctx.p1DataIndex >= recentData.length ? [6, 6] : undefined
          }
        }
      ]
    };
  };

  const realtimeChartData = prepareChartData(data, forecastData, showForecast);

  const prepareHistoricalChartData = () => {
    if (historicalData.length === 0) return { labels: [], datasets: [] };
  
    // Sort data by timestamp
    const sortedData = [...historicalData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
    // Determine time intervals based on selected range
    let interval;
    switch(timeRange) {
      case '1h':
        interval = 5 * 60 * 1000; // 5 minutes
        break;
      case '24h':
        interval = 60 * 60 * 1000; // 1 hour
        break;
      case '7d':
        interval = 24 * 60 * 60 * 1000; // 1 day
        break;
      case '30d':
        interval = 24 * 60 * 60 * 1000; // 1 day
        break;
      default:
        interval = 60 * 60 * 1000; // Default to 1 hour
    }
  
    // Create time buckets
    const now = new Date();
    const startTime = new Date(now.getTime() - 
      (timeRange === '1h' ? 60 * 60 * 1000 : 
       timeRange === '24h' ? 24 * 60 * 60 * 1000 : 
       timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 : 
       30 * 24 * 60 * 60 * 1000));
  
    const buckets = [];
    let currentTime = new Date(startTime);
  
    while (currentTime <= now) {
      buckets.push(new Date(currentTime));
      currentTime = new Date(currentTime.getTime() + interval);
    }
  
    // Aggregate data into buckets
    const aggregatedData = buckets.map((bucket, i) => {
      const nextBucket = i < buckets.length - 1 ? buckets[i + 1] : new Date(bucket.getTime() + interval);
      const bucketData = sortedData.filter(item => {
        const itemTime = new Date(item.timestamp);
        return itemTime >= bucket && itemTime < nextBucket;
      });
  
      if (bucketData.length === 0) return null;
  
      const avgTemp = bucketData.reduce((sum, item) => sum + item.temperature, 0) / bucketData.length;
      const avgHumidity = bucketData.reduce((sum, item) => sum + item.humidity, 0) / bucketData.length;
  
      return {
        timestamp: bucket,
        temperature: avgTemp,
        humidity: avgHumidity
      };
    });
  
    // Filter out empty buckets
    const filteredData = aggregatedData.filter(item => item !== null);
  
    // Format labels based on time range
    const labels = buckets.map(bucket => {
      if (timeRange === '1h') {
        return bucket.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (timeRange === '24h') {
        return bucket.toLocaleTimeString([], { hour: '2-digit' });
      } else {
        return bucket.toLocaleDateString([], { 
          month: 'short', 
          day: 'numeric',
          ...(timeRange === '7d' && { weekday: 'short' })
        });
      }
    });
  
    return {
      labels,
      datasets: [
        {
          label: "Temperature (°C)",
          data: filteredData.map(item => item.temperature),
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.3)",
          borderWidth: 3,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: "Humidity (%)",
          data: filteredData.map(item => item.humidity),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.3)",
          borderWidth: 3,
          fill: true,
          yAxisID: 'y1'
        }
      ]
    };
  };

  const historicalChartData = prepareHistoricalChartData();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    spanGaps: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: isDarkMode ? '#fff' : '#374151',
          font: { size: 14, family: 'Inter' },
          padding: 20,
          usePointStyle: true,
          boxWidth: 12,
          boxHeight: 12
        }
      },
      tooltip: {
        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
        titleColor: isDarkMode ? '#fff' : '#111827',
        bodyColor: isDarkMode ? '#fff' : '#111827',
        borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
        borderWidth: 1,
        padding: 12,
        bodyFont: {
          size: 14,
          weight: 'bold'
        },
        titleFont: {
          size: 12
        },
        cornerRadius: 8,
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += context.dataset.label.includes('Temperature')
                ? `${context.parsed.y.toFixed(1)}°C`
                : `${context.parsed.y.toFixed(1)}%`;
            }
            return label;
          },
          afterLabel: function (context) {
            if (typeof showForecast !== 'undefined' && showForecast && context.dataIndex >= data.length) {
              return 'Forecasted value';
            }
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          drawTicks: false
        },
        ticks: {
          color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(55,65,81,0.8)',
          font: { size: 12 },
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Temperature (°C)',
          color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(55,65,81,0.8)',
          font: { size: 12, weight: 'bold' }
        },
        min: (ctx) => {
          const values = ctx.chart.data.datasets[0]?.data || [];
          if (values.length === 0) return 0; // Default minimum
          const minValue = Math.min(...values.filter(v => v !== null));
          return Math.floor(minValue - 2); // Add 2 degrees buffer below min
        },
        max: (ctx) => {
          const values = ctx.chart.data.datasets[0]?.data || [];
          if (values.length === 0) return 30; // Default maximum
          const maxValue = Math.max(...values.filter(v => v !== null));
          return Math.ceil(maxValue + 2); // Add 2 degrees buffer above max
        },
        suggestedMin: 0,
        suggestedMax: 50,
        grid: {
          color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          drawTicks: false
        },
        ticks: {
          color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(55,65,81,0.8)',
          precision: 1,
          font: { size: 12 },
          padding: 8
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Humidity (%)',
          color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(55,65,81,0.8)',
          font: { size: 12, weight: 'bold' }
        },
        min: (ctx) => {
          const values = ctx.chart.data.datasets[1]?.data || [];
          if (values.length === 0) return 0; // Default minimum
          const minValue = Math.min(...values.filter(v => v !== null));
          return Math.max(0, Math.floor(minValue - 5)); // Add 5% buffer below min (but not below 0)
        },
        max: (ctx) => {
          const values = ctx.chart.data.datasets[1]?.data || [];
          if (values.length === 0) return 100; // Default maximum
          const maxValue = Math.max(...values.filter(v => v !== null));
          return Math.min(100, Math.ceil(maxValue + 5)); // Add 5% buffer above max (but not above 100)
        },
        suggestedMin: 0,
        suggestedMax: 100,
        grid: {
          drawOnChartArea: false,
          drawTicks: false
        },
        ticks: {
          color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(55,65,81,0.8)',
          precision: 1,
          font: { size: 12 },
          padding: 8
        }
      }
    },
    elements: {
      line: {
        tension: 0.3, // Reduced tension for smoother connections
        borderWidth: 2,
        fill: 'start',
        spanGaps: true // Allow lines to span gaps
      },
      point: {
        radius: 3,
        hoverRadius: 6,
        borderWidth: 2,
        hoverBorderWidth: 3
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };
 

  const historicalChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      legend: {
        ...chartOptions.plugins.legend,
        position: 'top',
        align: 'start'
      },
      title: {
        display: true,
        text: `Historical ${timeRangeOptions.find(o => o.value === timeRange)?.label || ''} Data`,
        color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(55,65,81,0.9)',
        font: {
          size: 16,
          weight: 'bold'
        },
        padding: {
          top: 10,
          bottom: 20
        }
      }
    },
    scales: {
      ...chartOptions.scales,
      x: {
        ...chartOptions.scales.x,
        grid: {
          display: true,
          color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
        },
        ticks: {
          color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(55,65,81,0.7)',
          font: { size: 11 },
          maxRotation: 0,
          minRotation: 0
        }
      },
      y: {
        ...chartOptions.scales.y,
        grid: {
          color: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          drawTicks: false
        }
      },
      y1: {
        ...chartOptions.scales.y1,
        grid: {
          drawOnChartArea: false,
          drawTicks: false
        }
      }
    }
  };

  if (isLoading || !isConnected) {
    return (
      <div className={`fixed inset-0 flex items-center justify-center bg-gradient-to-br ${isDarkMode ? 'from-gray-900 to-gray-800' : 'from-blue-50 to-gray-50'}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className={`${isDarkMode ? 'text-white' : 'text-gray-800'} text-2xl flex flex-col items-center`}
        >
          <svg className="animate-spin h-12 w-12 mb-4" style={{ color: isDarkMode ? '#fff' : '#3b82f6' }} viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {!isConnected ? "Trying to connect to ESP32 sensor..." : "Connecting to ESP32 sensor..."}
        </motion.div>
      </div>
    );
  }

  const latest = data.length > 0 ? 
  data.reduce((a, b) => a.timestamp > b.timestamp ? a : b) : 
  { temperature: null, humidity: null };
  const currentTheme = isDarkMode ? themeConfig.dark : themeConfig.light;
  const comfortIndex = calculateComfortIndex(
    hoveredData?.temperature ?? latest?.temperature, 
    hoveredData?.humidity ?? latest?.humidity
  );

  // Add this component inside the Dashboard component (before the return statement)
  const HistoricalDataTable = ({ data, isDarkMode, currentTheme, currentPage, setCurrentPage, rowsPerPage, setRowsPerPage }) => {
    const columns = [
      {
        name: 'Timestamp',
        selector: row => new Date(row.timestamp).toLocaleString(),
        sortable: true,
        width: '200px'
      },
      {
        name: 'Temperature (°C)',
        selector: row => row.temperature?.toFixed(1) || '--',
        sortable: true,
        cell: row => (
          <div className="flex items-center">
            <WiThermometer className="mr-2" style={{ color: isDarkMode ? '#f97316' : '#f97316' }} />
            {row.temperature?.toFixed(1) || '--'}
          </div>
        ),
        conditionalCellStyles: [
          {
            when: row => row.temperature > 30,
            style: {
              color: '#ef4444',
              fontWeight: 'bold'
            }
          },
          {
            when: row => row.temperature < 15,
            style: {
              color: '#3b82f6',
              fontWeight: 'bold'
            }
          }
        ]
      },
      {
        name: 'Humidity (%)',
        selector: row => row.humidity?.toFixed(1) || '--',
        sortable: true,
        cell: row => (
          <div className="flex items-center">
            <FaTint className="mr-2" style={{ color: isDarkMode ? '#3b82f6' : '#3b82f6' }} />
            {row.humidity?.toFixed(1) || '--'}
          </div>
        ),
        conditionalCellStyles: [
          {
            when: row => row.humidity > 70,
            style: {
              color: '#3b82f6',
              fontWeight: 'bold'
            }
          },
          {
            when: row => row.humidity < 30,
            style: {
              color: '#f59e0b',
              fontWeight: 'bold'
            }
          }
        ]
      },
      {
        name: 'Comfort Index',
        selector: row => {
          const ci = calculateComfortIndex(row.temperature, row.humidity);
          return ci ? ci.value : '--';
        },
        sortable: true,
        cell: row => {
          const ci = calculateComfortIndex(row.temperature, row.humidity);
          return ci ? (
            <div className={`px-3 py-1 rounded-full ${ci.color} ${ci.textColor}`}>
              {ci.level} ({ci.value})
            </div>
          ) : '--';
        }
      }
    ];

    const customStyles = {
      headRow: {
        style: {
          backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(243, 244, 246, 0.8)',
          color: isDarkMode ? '#fff' : '#111827',
          borderBottomWidth: '1px',
          borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      },
      headCells: {
        style: {
          fontSize: '14px',
          fontWeight: '600',
          textTransform: 'uppercase'
        }
      },
      cells: {
        style: {
          fontSize: '14px',
          color: isDarkMode ? '#fff' : '#111827',
          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.5)' : 'rgba(255, 255, 255, 0.5)'
        }
      },
      rows: {
        style: {
          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.5)' : 'rgba(255, 255, 255, 0.5)',
          '&:not(:last-of-type)': {
            borderBottomWidth: '1px',
            borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
          },
          '&:hover': {
            backgroundColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.5)'
          }
        }
      },
      pagination: {
        style: {
          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.5)' : 'rgba(255, 255, 255, 0.5)',
          color: isDarkMode ? '#fff' : '#111827',
          borderTopWidth: '1px',
          borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      }
    };
    const handlePageChange = page => {
      setCurrentPage(page);
    };
  
    const handleRowsPerPageChange = (currentRowsPerPage, currentPage) => {
      setRowsPerPage(currentRowsPerPage);
      setCurrentPage(currentPage);
    };

    return (
      <div className={`${currentTheme.cardBg} backdrop-blur-md rounded-2xl p-5 shadow-xl border ${currentTheme.border} transition-all h-full flex flex-col`}>
        <h3 className={`${currentTheme.text} text-xl font-semibold mb-4`}>Historical Data Records</h3>
        <div className="flex-grow">
          <DataTable
            columns={columns}
            data={historicalData}
            customStyles={customStyles}
            pagination
            paginationPerPage={rowsPerPage}
            paginationRowsPerPageOptions={[10, 20, 50]}
            paginationDefaultPage={currentPage}
            onChangePage={handlePageChange}
            onChangeRowsPerPage={handleRowsPerPageChange}
            highlightOnHover
            responsive
            defaultSortFieldId={1}
            defaultSortAsc={false}
            theme={isDarkMode ? 'dark' : 'light'}
            persistTableHead
            noDataComponent={
              <div className={`p-4 text-center ${currentTheme.textMuted}`}>
                No historical data available
              </div>
            }
          />
        </div>
      </div>
    );
  };
  

  return (
    <div 
      ref={dashboardRef}
      className={`fixed inset-0 flex flex-col bg-gradient-to-br ${currentTheme.bg} overflow-y-auto transition-colors duration-300`}
    >
      <Particles
        id="tsparticles"
        init={particlesInit}
        options={{
          fpsLimit: 60,
          interactivity: { 
            events: { 
              onClick: { enable: true, mode: "push" }, 
              onHover: { enable: true, mode: "grab" } 
            } 
          },
          particles: {
            color: { value: currentTheme.particleColor },
            links: { 
              color: currentTheme.particleColor, 
              distance: 150, 
              enable: true, 
              opacity: 0.4, 
              width: 1 
            },
            move: { 
              direction: "none", 
              enable: true, 
              outModes: { default: "out" }, 
              random: true, 
              speed: 1 
            },
            number: { 
              density: { enable: true, area: 800 }, 
              value: 40 
            },
            opacity: { 
              value: 0.5, 
              random: true, 
              anim: { enable: true, speed: 1, opacity_min: 0.1 } 
            },
            size: { 
              value: 3, 
              random: true, 
              anim: { enable: true, speed: 2, size_min: 0.1 } 
            },
          },
          detectRetina: true,
        }}
      />

      <div className="p-6 relative z-10">
        <div className="flex justify-between items-start">
          <div>
            <h1 className={`${currentTheme.text} text-4xl font-bold flex items-center`}>
              <motion.span 
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 5 }}
                className="inline-block mr-3 cursor-pointer hover:scale-110 transition-transform"
                onClick={toggleTheme}
              >
                {currentTheme.icon}
              </motion.span>
              IoT Air Quality Dashboard
            </h1>
            <p className={`${currentTheme.textMuted} mt-2 text-lg`}>
              Real-time environment monitoring from ESP32
            </p>
          </div>
          <div className="flex items-center gap-4">
            {firmwareVersion && (
              <div className={`${currentTheme.cardBg} backdrop-blur-lg rounded-full p-2 border ${currentTheme.border}`}>
                <div className={`${currentTheme.text} text-sm flex items-center gap-2`}>
                  <span>Firmware:</span>
                  <span className="font-mono">{firmwareVersion}</span>
                </div>
              </div>
            )}
            <div className={`${currentTheme.cardBg} backdrop-blur-lg rounded-full p-2 border ${currentTheme.border} flex items-center gap-2`}>
              <div className={currentTheme.text}>
                {isConnected ? (
                  <div className="flex items-center gap-2">
                    <FaWifi className="text-green-400" />
                    <span>Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <FiWifiOff className="text-red-400" />
                    <span>Disconnected</span>
                  </div>
                )}
              </div>
            </div>
            <div className={`${currentTheme.cardBg} backdrop-blur-lg rounded-full p-2 border ${currentTheme.border}`}>
              <div className={currentTheme.text}>
                {time.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 z-10">
        {/* Temperature Card */}
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100 }}
          className={`${currentTheme.cardBg} backdrop-blur-md rounded-2xl p-5 shadow-xl border ${currentTheme.border} transition-all`}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className={`${currentTheme.textMuted} text-sm uppercase tracking-wider`}>Temperature</p>
              <motion.p 
                className={`${currentTheme.text} text-4xl font-bold mt-1`}
                key={`temp-${latest?.timestamp}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
              {(hoveredData?.temperature ?? latest?.temperature)?.toFixed(1) || "--"}°C
              </motion.p>
              <p className={`${currentTheme.textMuted} text-sm mt-2`}>
                {latest?.temperature ? (
                  latest.temperature > 30 ? "Heat warning" :
                  latest.temperature < 15 ? "Cold alert" :
                  "Optimal range"
                ) : "No data"}
              </p>
            </div>
            <div className={`${currentTheme.cardBg} p-3 rounded-full`}>
              <WiThermometer className="text-4xl" style={{ color: isDarkMode ? '#fff' : '#f97316' }} />
            </div>
          </div>
          <div className={`mt-4 h-2 ${currentTheme.cardBg} rounded-full overflow-hidden`}>
            <motion.div 
              className="h-full bg-gradient-to-r from-amber-300 to-red-500 rounded-full" 
              initial={{ width: 0 }}
              animate={{ 
                width: `${((hoveredData?.temperature ?? latest?.temperature) || 0) / 50 * 100}%`,
                transition: { duration: 0.5 }
              }}
            />
          </div>
        </motion.div>

        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100 }}
          className={`${currentTheme.cardBg} backdrop-blur-md rounded-2xl p-5 shadow-xl border ${currentTheme.border} transition-all`}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className={`${currentTheme.textMuted} text-sm uppercase tracking-wider`}>Humidity</p>
              <AnimatePresence mode="wait">
              <motion.p 
  className={`${currentTheme.text} text-4xl font-bold mt-1`}
  key={`humidity-${latest?.timestamp}`}
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.3 }}
>
  {(hoveredData?.humidity ?? latest?.humidity)?.toFixed(1) || "--"}%
</motion.p>
              </AnimatePresence>
              <p className={`${currentTheme.textMuted} text-sm mt-2`}>
                {latest?.humidity ? (
                  latest.humidity > 70 ? "Very humid" :
                  latest.humidity < 30 ? "Very dry" :
                  "Comfortable"
                ) : "No data"}
              </p>
            </div>
            <div className={`${currentTheme.cardBg} p-3 rounded-full`}>
              <FaTint className="text-4xl" style={{ color: isDarkMode ? '#fff' : '#3b82f6' }} />
            </div>
          </div>
          <div className={`mt-4 h-2 ${currentTheme.cardBg} rounded-full overflow-hidden`}>
            <motion.div 
              className="h-full bg-gradient-to-r from-blue-300 to-indigo-500 rounded-full" 
              initial={{ width: 0 }}
              animate={{ 
                width: `${(hoveredData?.humidity ?? latest?.humidity) || 0}%`,
                transition: { duration: 0.5 }
              }}
            />
          </div>
        </motion.div>

        <motion.div 
        initial={{ x: 50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100 }}
        className={`${comfortIndex ? comfortIndex.color : currentTheme.cardBg} backdrop-blur-md rounded-2xl p-5 shadow-xl border ${currentTheme.border} transition-all`}
      >
        <div className="flex justify-between items-center">
          <div>
            <p className={`${currentTheme.textMuted} text-sm uppercase tracking-wider`}>Comfort Index</p>
            <AnimatePresence mode="wait">
              <motion.p 
                key={comfortIndex?.value ?? "--"}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
                className={`${comfortIndex ? comfortIndex.textColor : currentTheme.text} text-4xl font-bold mt-1`}
              >
                {comfortIndex ? comfortIndex.value : "--"} THI
              </motion.p>
            </AnimatePresence>
            <p className={`${comfortIndex ? comfortIndex.textColor : currentTheme.textMuted} text-sm mt-2`}>
              {comfortIndex ? comfortIndex.level : "No data"}
            </p>
          </div>
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className={`${currentTheme.cardBg} p-3 rounded-full`}
          >
            {comfortIndex ? comfortIndex.icon : <WiThermometer className="text-4xl" />}
          </motion.div>
        </div>
        <div className={`mt-4 h-2 ${currentTheme.cardBg} rounded-full overflow-hidden`}>
          <div 
            className={`h-full ${comfortIndex ? comfortIndex.color.replace('/70', '/90') : 'bg-gray-500'} rounded-full`}
            style={{ width: "100%" }}
          />
        </div>
      </motion.div>
    </div>

    <div className="flex flex-wrap justify-center gap-4 mt-4 z-10 px-6">
        <div className={`${currentTheme.cardBg} backdrop-blur-md rounded-full p-1 border ${currentTheme.border}`}>
          {timeRangeOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setTimeRange(option.value)}
              className={`px-4 py-1 rounded-full ${timeRange === option.value ? currentTheme.accent : ''} ${timeRange === option.value ? currentTheme.text : currentTheme.text}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className={`${currentTheme.cardBg} backdrop-blur-md rounded-full p-1 border ${currentTheme.border}`}>
          <button 
            onClick={() => setShowForecast(!showForecast)}
            className={`px-4 py-1 rounded-full flex items-center gap-2 ${showForecast ? currentTheme.accent : ''} ${currentTheme.text}`}
          >
            <span>🔮 Forecast Prediction</span>
            <span className="text-xs opacity-70">{showForecast ? 'ON' : 'OFF'}</span>
          </button>
        </div>
        <div className={`${currentTheme.cardBg} backdrop-blur-md rounded-full p-1 border ${currentTheme.border}`}>
          <button 
            onClick={() => setShowFirmwareUpdate(!showFirmwareUpdate)}
            className={`px-4 py-1 rounded-full flex items-center gap-2 ${showFirmwareUpdate ? currentTheme.accent : ''} ${currentTheme.text}`}
          >
            <FaUpload />
            <span>Firmware Update</span>
          </button>
        </div>
      </div>

      {showFirmwareUpdate && (
        <div className="px-6 mt-4 z-10">
          <FirmwareUpdate 
            isDarkMode={isDarkMode} 
            currentTheme={currentTheme} 
            isLoggedIn={isLoggedIn}
            onLogin={login}
            onClose={() => setShowFirmwareUpdate(false)}
          />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 z-10">
        {/* Real-time chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${currentTheme.cardBg} backdrop-blur-md rounded-2xl p-5 shadow-xl border ${currentTheme.border} transition-all flex flex-col`}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className={`${currentTheme.text} text-xl font-semibold`}>
              {showForecast ? 'Real-time + 12h Forecast' : 'Real-time Data'}
            </h3>
            {showForecast && (
              <div className={`${currentTheme.cardBg} text-xs px-2 py-1 rounded-full ${currentTheme.text}`}>
                Linear regression prediction
              </div>
            )}
          </div>
          <div className="flex-grow min-h-[400px]">
            <Line data={realtimeChartData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Historical data */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${currentTheme.cardBg} backdrop-blur-md rounded-2xl p-5 shadow-xl border ${currentTheme.border} transition-all flex flex-col`}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className={`${currentTheme.text} text-xl font-semibold`}>
              Historical Trends
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`${currentTheme.cardBg} text-xs px-3 py-1 rounded-full ${currentTheme.text} ${showHeatmap ? 'bg-opacity-50' : ''}`}
              >
                {showHeatmap ? 'Show Chart' : 'Show Heatmap'}
              </button>
            </div>
          </div>
          
          <div className="flex-grow min-h-[400px]">
            {showHeatmap ? (
              <Bar 
                data={historicalChartData} 
                options={{
                  ...historicalChartOptions,
                  plugins: {
                    ...historicalChartOptions.plugins,
                    subtitle: {
                      display: true,
                      text: `Hourly ${activeTab} patterns`,
                      color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(55,65,81,0.7)',
                      font: { size: 12 }
                    }
                  }
                }}
              />
            ) : (
              <Line 
                data={historicalChartData} 
                options={{
                  ...historicalChartOptions,
                  plugins: {
                    ...historicalChartOptions.plugins,
                    subtitle: {
                      display: true,
                      text: `${timeRange === '1h' ? 'Minute' : timeRange === '24h' ? 'Hourly' : timeRange === '7d' ? 'Daily' : 'Monthly'} trends`,
                      color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(55,65,81,0.7)',
                      font: { size: 12 }
                    }
                  }
                }}
              />
            )}
          </div>
        </motion.div>
      </div>

      {/* Data table section */}
      <div className="px-6 pb-6 z-10">
      <HistoricalDataTable 
        data={historicalData} 
        isDarkMode={isDarkMode} 
        currentTheme={currentTheme}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        rowsPerPage={rowsPerPage}
        setRowsPerPage={setRowsPerPage}
      />
      </div>

      {/* Last updated section */}
      <div className={`p-4 text-center text-sm z-10 ${currentTheme.textMuted}`}>
        <p>Last updated: {time.toLocaleTimeString()} | {isConnected ? "Connected to ESP32" : "Disconnected from ESP32"}</p>
      </div>
    </div>
  );
};

export default Dashboard;
