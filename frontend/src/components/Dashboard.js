import React, { useEffect, useState, useRef, useCallback } from "react";
import { Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { WiThermometer, WiNightClear, WiDaySunny, WiRain, WiSnow, WiCloud } from "react-icons/wi";
import { FaTint, FaMoon, FaSun, FaWifi, FaWifiSlash, FaUpload } from "react-icons/fa";
import { motion } from "framer-motion";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import { FiWifiOff } from "react-icons/fi";
import FirmwareUpdate from "./FirmwareUpdate";
import axios from "axios";

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
  const [timeRange, setTimeRange] = useState('day');
  const [showForecast, setShowForecast] = useState(false);
  const [forecastData, setForecastData] = useState({ temp: [], humidity: [] });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [showFirmwareUpdate, setShowFirmwareUpdate] = useState(false);
  const [firmwareVersion, setFirmwareVersion] = useState(null);
  const dashboardRef = useRef(null);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const ESP32_API_URL = "http://localhost:5000/api/data";

  const themeConfig = {
    dark: {
      bg: 'from-indigo-900 to-gray-900',
      particleColor: '#4f46e5',
      icon: <FaMoon className="text-yellow-200" />,
      text: 'text-white',
      textMuted: 'text-white/80',
      cardBg: 'bg-white/10',
      border: 'border-white/20',
      chartGrid: 'rgba(255,255,255,0.1)',
      chartText: 'rgba(255,255,255,0.8)'
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
      chartText: 'rgba(55,65,81,0.8)'
    }
  };

  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine);
  }, [isDarkMode]);

  const fetchData = async () => {
    try {
      const response = await fetch(ESP32_API_URL);
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const dataArray = await response.json();
      if (!dataArray.length) throw new Error('No data available');
      
      const formattedData = dataArray.map(item => ({
        timestamp: item.timestamp || new Date().toISOString(),
        temperature: parseFloat(item.temperature) || 0,
        humidity: parseFloat(item.humidity) || 0
      }));
      
      setData(formattedData);
      setIsConnected(true);
      setIsLoading(false);
      
      // Check firmware version periodically
      if (Math.random() < 0.1) { // 10% chance to check (reduce server load)
        checkFirmwareVersion();
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setIsConnected(false);
    }
  };

  const checkFirmwareVersion = async () => {
    try {
      const response = await axios.get(`${ESP32_API_URL}/firmware/latest`);
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
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchHistoricalData();
  }, [timeRange]);

  useEffect(() => {
    const interval = setInterval(fetchHistoricalData, 3600000);
    return () => clearInterval(interval);
  }, [timeRange]);

  useEffect(() => {
    if (data.length > 1) {
      setForecastData(generateForecast(data));
    }
  }, [data]);

  useEffect(() => {
    const checkForFrontendUpdates = async () => {
      try {
        const response = await fetch(`${ESP32_API_URL}/frontend/version`);
        const { version, url } = await response.json();
        
        if (version !== process.env.REACT_APP_VERSION) {
          const shouldUpdate = window.confirm(
            "A new version is available. Reload to update?"
          );
          if (shouldUpdate) {
            window.location.href = url; // Redirect to latest Vercel deployment
          }
        }
      } catch (error) {
        console.error("Failed to check frontend version:", error);
      }
    };
  
    // Check every 5 minutes
    const interval = setInterval(checkForFrontendUpdates, 300000);
    return () => clearInterval(interval);
  }, []);

  const prepareChartData = (baseData, forecast, showForecast) => {
    const baseLabels = baseData.map(d => new Date(d.timestamp).toLocaleTimeString());
    const forecastLabels = Array.from({ length: forecast.temp.length }, (_, i) => {
      const date = new Date();
      date.setHours(date.getHours() + i + 1);
      return date.toLocaleTimeString();
    });

    return {
      labels: showForecast ? [...baseLabels, ...forecastLabels] : baseLabels,
      datasets: [
        {
          label: "Temperature (°C)",
          data: showForecast 
            ? [...baseData.map(d => d.temperature), ...forecast.temp]
            : baseData.map(d => d.temperature),
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.3)",
          borderWidth: 3,
          pointRadius: (ctx) => showForecast && ctx.dataIndex >= baseData.length ? 6 : 5,
          pointBackgroundColor: (ctx) => showForecast && ctx.dataIndex >= baseData.length ? "#fff" : "#fff",
          pointBorderColor: (ctx) => showForecast && ctx.dataIndex >= baseData.length ? "#f97316" : "#f97316",
          pointHoverRadius: (ctx) => showForecast && ctx.dataIndex >= baseData.length ? 10 : 8,
          pointHoverBorderWidth: 3,
          pointStyle: (ctx) => showForecast && ctx.dataIndex >= baseData.length ? 'triangle' : 'circle',
          fill: true,
          tension: 0.4,
          yAxisID: 'y',
          segment: {
            borderDash: (ctx) => showForecast && ctx.p1DataIndex >= baseData.length ? [6, 6] : undefined
          }
        },
        {
          label: "Humidity (%)",
          data: showForecast 
            ? [...baseData.map(d => d.humidity), ...forecast.humidity]
            : baseData.map(d => d.humidity),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.3)",
          borderWidth: 3,
          pointRadius: (ctx) => showForecast && ctx.dataIndex >= baseData.length ? 6 : 5,
          pointBackgroundColor: (ctx) => showForecast && ctx.dataIndex >= baseData.length ? "#fff" : "#fff",
          pointBorderColor: (ctx) => showForecast && ctx.dataIndex >= baseData.length ? "#3b82f6" : "#3b82f6",
          pointHoverRadius: (ctx) => showForecast && ctx.dataIndex >= baseData.length ? 10 : 8,
          pointHoverBorderWidth: 3,
          pointStyle: (ctx) => showForecast && ctx.dataIndex >= baseData.length ? 'triangle' : 'circle',
          fill: true,
          tension: 0.4,
          yAxisID: 'y1',
          segment: {
            borderDash: (ctx) => showForecast && ctx.p1DataIndex >= baseData.length ? [6, 6] : undefined
          }
        },
      ],
    };
  };

  const realtimeChartData = prepareChartData(data, forecastData, showForecast);

  const historicalChartData = {
    labels: historicalData.map((d) => {
      const date = new Date(d.timestamp);
      if (isNaN(date.getTime())) return "Invalid Date";
      
      if (timeRange === 'day') {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
      }
    }),
    datasets: [
      {
        label: "Temperature (°C)",
        data: historicalData.map(d => d.temperature),
        backgroundColor: isDarkMode ? "rgba(249, 115, 22, 0.7)" : "rgba(249, 115, 22, 0.9)",
        borderColor: isDarkMode ? "rgba(249, 115, 22, 0.9)" : "rgba(249, 115, 22, 1)",
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false,
        yAxisID: 'y',
      },
      {
        label: "Humidity (%)",
        data: historicalData.map(d => d.humidity),
        backgroundColor: isDarkMode ? "rgba(59, 130, 246, 0.7)" : "rgba(59, 130, 246, 0.9)",
        borderColor: isDarkMode ? "rgba(59, 130, 246, 0.9)" : "rgba(59, 130, 246, 1)",
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false,
        yAxisID: 'y1',
      },
    ],
  };

  const getDynamicYAxisRange = (values, isHumidity = false) => {
    if (!values || values.length === 0) return { min: 0, max: isHumidity ? 100 : 30 };
    
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;
    
    const minRange = isHumidity ? 10 : 5;
    
    if (range < minRange) {
      const center = (minValue + maxValue) / 2;
      return {
        min: Math.max(0, center - minRange/2),
        max: isHumidity ? Math.min(100, center + minRange/2) : center + minRange/2
      };
    }
    
    return {
      min: Math.max(0, minValue - range * 0.1),
      max: isHumidity ? Math.min(100, maxValue + range * 0.1) : maxValue + range * 0.1
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
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
            if (showForecast && context.dataIndex >= data.length) {
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
        ...getDynamicYAxisRange(data.map(d => d.temperature)),
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
        ...getDynamicYAxisRange(data.map(d => d.humidity)),
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
        tension: 0.4,
        borderWidth: 3,
        fill: 'start'
      },
      point: {
        radius: (context) =>
          context.dataIndex === context.dataset.data.length - 1 ? 8 : 5,
        hoverRadius: 10,
        borderWidth: 2,
        hoverBorderWidth: 3
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    }
  };

  const historicalChartOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      x: {
        ...chartOptions.scales.x,
        grid: {
          display: false,
          color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
        },
        ticks: {
          maxTicksLimit: timeRange === 'day' ? 12 : 7,
          color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(55,65,81,0.8)',
          font: { size: 11 },
          maxRotation: 0,
          minRotation: 0
        }
      },
      y: {
        ...chartOptions.scales.y,
        ...getDynamicYAxisRange(historicalData.map(d => d.temperature)),
        grid: {
          color: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          drawTicks: false
        }
      },
      y1: {
        ...chartOptions.scales.y1,
        ...getDynamicYAxisRange(historicalData.map(d => d.humidity), true),
        grid: {
          drawOnChartArea: false,
          drawTicks: false
        }
      }
    },
    plugins: {
      ...chartOptions.plugins,
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          ...chartOptions.plugins.tooltip.callbacks,
          title: function(context) {
            const date = new Date(historicalData[context[0].dataIndex].timestamp);
            return date.toLocaleString();
          }
        }
      }
    }
  };

  if (isLoading || !isConnected) {
    return (
      <div className={`fixed inset-0 flex items-center justify-center bg-gradient-to-br ${isDarkMode ? 'from-indigo-900 to-gray-900' : 'from-blue-50 to-gray-50'}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
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

  const latest = data.length > 0 ? data[data.length - 1] : { temperature: null, humidity: null };
  const currentTheme = isDarkMode ? themeConfig.dark : themeConfig.light;
  const comfortIndex = calculateComfortIndex(latest?.temperature, latest?.humidity);

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
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={`${currentTheme.cardBg} backdrop-blur-md rounded-2xl p-5 shadow-xl border ${currentTheme.border} transition-all`}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className={`${currentTheme.textMuted} text-sm uppercase tracking-wider`}>Temperature</p>
              <p className={`${currentTheme.text} text-4xl font-bold mt-1`}>
                {latest?.temperature?.toFixed(1) || "--"}°C
              </p>
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
            <div 
              className="h-full bg-gradient-to-r from-amber-300 to-red-500 rounded-full" 
              style={{ width: `${latest?.temperature ? (latest.temperature / 50) * 100 : 0}%` }}
            />
          </div>
        </motion.div>

        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`${currentTheme.cardBg} backdrop-blur-md rounded-2xl p-5 shadow-xl border ${currentTheme.border} transition-all`}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className={`${currentTheme.textMuted} text-sm uppercase tracking-wider`}>Humidity</p>
              <p className={`${currentTheme.text} text-4xl font-bold mt-1`}>
                {latest?.humidity?.toFixed(1) || "--"}%
              </p>
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
            <div 
              className="h-full bg-gradient-to-r from-blue-300 to-indigo-500 rounded-full" 
              style={{ width: `${latest?.humidity || 0}%` }}
            />
          </div>
        </motion.div>

        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={`${comfortIndex ? comfortIndex.color : currentTheme.cardBg} backdrop-blur-md rounded-2xl p-5 shadow-xl border ${currentTheme.border} transition-all`}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className={`${currentTheme.textMuted} text-sm uppercase tracking-wider`}>Comfort Index</p>
              <p className={`${comfortIndex ? comfortIndex.textColor : currentTheme.text} text-4xl font-bold mt-1`}>
                {comfortIndex ? comfortIndex.value : "--"} THI
              </p>
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

      <div className="flex justify-center gap-4 mt-4 z-10">
        <div className={`${currentTheme.cardBg} backdrop-blur-md rounded-full p-1 border ${currentTheme.border}`}>
          <button 
            onClick={() => setTimeRange('day')}
            className={`px-4 py-1 rounded-full ${timeRange === 'day' ? currentTheme.cardBg : ''} ${currentTheme.text}`}
          >
            Previous Day
          </button>
          <button 
            onClick={() => setTimeRange('week')}
            className={`px-4 py-1 rounded-full ${timeRange === 'week' ? currentTheme.cardBg : ''} ${currentTheme.text}`}
          >
            Previous Week
          </button>
        </div>
        <div className={`${currentTheme.cardBg} backdrop-blur-md rounded-full p-1 border ${currentTheme.border}`}>
          <button 
            onClick={() => setShowForecast(!showForecast)}
            className={`px-4 py-1 rounded-full flex items-center gap-2 ${showForecast ? currentTheme.cardBg : ''} ${currentTheme.text}`}
          >
            <span>🔮 Forecast Prediction</span>
            <span className="text-xs opacity-70">{showForecast ? 'ON' : 'OFF'}</span>
          </button>
        </div>
        <div className={`${currentTheme.cardBg} backdrop-blur-md rounded-full p-1 border ${currentTheme.border}`}>
          <button 
            onClick={() => setShowFirmwareUpdate(!showFirmwareUpdate)}
            className={`px-4 py-1 rounded-full flex items-center gap-2 ${showFirmwareUpdate ? currentTheme.cardBg : ''} ${currentTheme.text}`}
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
            onClose={() => setShowFirmwareUpdate(false)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${currentTheme.cardBg} backdrop-blur-md rounded-2xl p-5 shadow-xl border ${currentTheme.border} transition-all`}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className={`${currentTheme.text} text-xl font-semibold`}>
              {showForecast ? 'Real-time + 12h Forecast' : 'Real-time Data (Last 30 minutes)'}
            </h3>
            {showForecast && (
              <div className={`${currentTheme.cardBg} text-xs px-2 py-1 rounded-full ${currentTheme.text}`}>
                Linear regression prediction
              </div>
            )}
          </div>
          <div className="h-96">
            <Line data={realtimeChartData} options={chartOptions} />
          </div>
        </motion.div>
        <motion.div 
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className={`${currentTheme.cardBg} backdrop-blur-md rounded-2xl p-5 shadow-xl border ${currentTheme.border} transition-all`}
>
  <div className="flex justify-between items-center mb-4">
    <h3 className={`${currentTheme.text} text-xl font-semibold`}>
      Historical Data ({timeRange === 'day' ? 'Previous Day' : 'Previous Week'})
    </h3>
    <div className={`${currentTheme.cardBg} text-xs px-2 py-1 rounded-full ${currentTheme.text}`}>
      {timeRange === 'day' ? 'Hourly' : 'Daily'} averages
    </div>
  </div>
  <div className="h-96">
    <Bar 
      data={historicalChartData} 
      options={historicalChartOptions}
    />
  </div>
</motion.div>
      
      </div>

      <div className={`p-4 text-center text-sm z-10 ${currentTheme.textMuted}`}>
        <p>Last updated: {time.toLocaleTimeString()} | {isConnected ? "Connected to ESP32" : "Disconnected from ESP32"}</p>
      </div>
    </div>
  );
};

export default Dashboard;