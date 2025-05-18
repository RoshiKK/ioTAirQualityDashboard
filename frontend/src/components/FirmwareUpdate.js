import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

const FirmwareUpdate = ({ isDarkMode, currentTheme, isLoggedIn, onLogin }) => {
  const [file, setFile] = useState(null);
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const success = await onLogin(username.trim(), password.trim());
      if (success) {
        setLoginError('');
        // No need to manually set token here as onLogin should handle it
      } else {
        setLoginError('Invalid credentials');
      }
    } catch (error) {
      console.error("Login error:", error);
      setLoginError(error.response?.data?.error || 'Login failed');
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isLoggedIn) {
      setUploadStatus({ success: false, message: 'Please login first' });
      return;
    }
  
    setIsUploading(true);
    const formData = new FormData();
    formData.append('firmware', file);
    formData.append('version', version);
    formData.append('description', description);
  
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post('http://localhost:5000/api/data/firmware', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      setUploadStatus({ success: true, message: 'Firmware uploaded successfully!' });
      setFile(null);
      setVersion('');
      setDescription('');
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus({ 
        success: false, 
        message: error.response?.data?.error || 'Upload failed. Please try again.' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${currentTheme.cardBg} backdrop-blur-md rounded-2xl p-5 shadow-xl border ${currentTheme.border} transition-all`}
    >
      {!isLoggedIn ? (
        <div>
          <h2 className={`${currentTheme.text} text-xl font-semibold mb-4`}>Admin Login</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full p-2 mb-2 rounded-lg ${currentTheme.cardBg} border ${currentTheme.border} ${currentTheme.text}`}
                required
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full p-2 rounded-lg ${currentTheme.cardBg} border ${currentTheme.border} ${currentTheme.text}`}
                required
              />
            </div>
            {loginError && (
              <div className="text-red-500 text-sm">{loginError}</div>
            )}
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      ) : (
        <>
          <h2 className={`${currentTheme.text} text-xl font-semibold mb-4`}>Firmware Update</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`${currentTheme.textMuted} block text-sm mb-1`}>Firmware File (.bin)</label>
              <input
                type="file"
                accept=".bin"
                onChange={handleFileChange}
                className={`w-full p-2 rounded-lg ${currentTheme.cardBg} border ${currentTheme.border} ${currentTheme.text}`}
                required
              />
            </div>
            
            <div>
              <label className={`${currentTheme.textMuted} block text-sm mb-1`}>Version Number</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g., 1.0.1"
                className={`w-full p-2 rounded-lg ${currentTheme.cardBg} border ${currentTheme.border} ${currentTheme.text}`}
                required
              />
            </div>
            
            <div>
              <label className={`${currentTheme.textMuted} block text-sm mb-1`}>Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's new in this version?"
                className={`w-full p-2 rounded-lg ${currentTheme.cardBg} border ${currentTheme.border} ${currentTheme.text}`}
                rows="3"
              />
            </div>
            
            <button
              type="submit"
              disabled={isUploading}
              className={`px-4 py-2 rounded-lg ${isUploading ? 'bg-gray-500' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-medium transition-colors`}
            >
              {isUploading ? 'Uploading...' : 'Upload Firmware'}
            </button>
            
            {uploadStatus && (
              <div className={`p-3 rounded-lg ${uploadStatus.success ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                {uploadStatus.message}
              </div>
            )}
          </form>
          
          <div className="mt-6">
            <h3 className={`${currentTheme.textMuted} text-sm uppercase mb-2`}>OTA Update Instructions</h3>
            <ol className={`${currentTheme.textMuted} text-sm list-decimal list-inside space-y-1`}>
              <li>Compile your Arduino sketch and export the .bin file</li>
              <li>Upload the .bin file using this form</li>
              <li>The ESP32 will automatically check for updates every 5 minutes</li>
              <li>When an update is available, it will download and install it</li>
            </ol>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default FirmwareUpdate;