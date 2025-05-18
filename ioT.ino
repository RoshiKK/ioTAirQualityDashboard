#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoOTA.h>
#include <Update.h>
#include <time.h>
#include <ArduinoJson.h> 

#define DHTPIN 4
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

// WiFi credentials
const char* ssid = "Pixel_3285";
const char* password = "12345678";

// Server configuration - using HTTP (not HTTPS)
const char* serverUrl = "http://10.200.255.163:5000/api/data/";
const char* firmwareUrl = "http://10.200.255.163:5000/api/data/firmware/latest";

// OTA Update Credentials
const char* otaPassword = "Roshik123";

// Device authentication
const char* deviceToken = "8f3a9c7e4d2b1f0e6a5d9b2c3e7f1a4c5d8e9f0b2a6c7d4e1b9f3a2d5c7e8f0a";

WiFiClient client;
HTTPClient http;

String currentVersion = "1.0.0";
unsigned long lastUpdateCheck = 0;
const unsigned long updateCheckInterval = 300000; // 5 minutes
unsigned long lastDataSend = 0;
const unsigned long dataSendInterval = 10000; // 10 seconds

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  connectToWiFi();
  configTime(0, 0, "pool.ntp.org"); // Configure NTP
  setupOTA();
}

void connectToWiFi() {
  Serial.println("Connecting to WiFi...");
  WiFi.disconnect(true);
  delay(1000);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.println("\nWiFi Connection Details:");
  Serial.print("SSID: ");
  Serial.println(ssid);
  Serial.print("MAC Address: ");
  Serial.println(WiFi.macAddress());
  
  unsigned long startAttemptTime = millis();
  
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 20000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nFailed to connect to WiFi");
    Serial.print("Status: ");
    Serial.println(WiFi.status());
    Serial.print("RSSI: ");
    Serial.println(WiFi.RSSI());
    Serial.println("Restarting...");
    ESP.restart();
  } else {
    Serial.println("\nConnected to WiFi");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Subnet Mask: ");
    Serial.println(WiFi.subnetMask());
    Serial.print("Gateway IP: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("DNS IP: ");
    Serial.println(WiFi.dnsIP());
    Serial.print("Signal Strength: ");
    Serial.println(WiFi.RSSI());
    Serial.print("Server URL: ");
    Serial.println(serverUrl);
  }
}

void setupOTA() {
  ArduinoOTA.setPassword(otaPassword);

  ArduinoOTA
    .onStart([]() {
      String type;
      if (ArduinoOTA.getCommand() == U_FLASH)
        type = "sketch";
      else
        type = "filesystem";
      Serial.println("Start updating " + type);
    })
    .onEnd([]() {
      Serial.println("\nEnd");
    })
    .onProgress([](unsigned int progress, unsigned int total) {
      Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
    })
    .onError([](ota_error_t error) {
      Serial.printf("Error[%u]: ", error);
      if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
      else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
      else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
      else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
      else if (error == OTA_END_ERROR) Serial.println("End Failed");
    });

  ArduinoOTA.begin();
  Serial.println("OTA Ready");
}

String getTimeStamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return "1970-01-01T00:00:00Z";
  }
  char timeString[25];
  strftime(timeString, sizeof(timeString), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(timeString);
}

void sendSensorData(float temperature, float humidity) {
  static unsigned long lastSendTime = 0;
  const unsigned long minSendInterval = 10000; // 10 seconds minimum between sends
  
  if (millis() - lastSendTime < minSendInterval) {
    return; // Skip if not enough time has passed
  }
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, attempting reconnect...");
    connectToWiFi();
    return;
  }

  // Create JSON payload with device ID
  DynamicJsonDocument doc(256);
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["timestamp"] = getTimeStamp();
  doc["deviceId"] = WiFi.macAddress();

  String payload;
  serializeJson(doc, payload);

  http.begin(client, serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(deviceToken));

  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    lastSendTime = millis(); // Update last send time only on success
    Serial.printf("HTTP Response code: %d\n", httpCode);
    if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
      String response = http.getString();
      Serial.println("Server response: " + response);
    }
  } else {
    Serial.printf("HTTP Error code: %d\n", httpCode);
    Serial.println("Error description: " + http.errorToString(httpCode));
  }
  http.end();
}

void loop() {
  ArduinoOTA.handle();

  // Check WiFi connection and reconnect if needed
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, attempting to reconnect...");
    connectToWiFi();
    delay(1000); // Wait before retrying
    return;
  }

  if (millis() - lastDataSend > dataSendInterval) {
    lastDataSend = millis();
    
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("Failed to read from DHT sensor!");
      // Reset sensor if needed
      dht.begin();
    } else {
      Serial.printf("Sensor readings - Temp: %.1f°C, Humidity: %.1f%%\n", temperature, humidity);
      sendSensorData(temperature, humidity);
    }
  }

  delay(100);
}