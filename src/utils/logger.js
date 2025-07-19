/**
 * Logger Modülü
 * Uygulama genelinde tutarlı log kaydı sağlar.
 * Modül bazlı loglama, seviyelendirme, konsol çıktısı,
 * hafızada tutma ve harici servislere gönderme yetenekleri sunar.
 */

import appConfig from '@/config'; // Merkezi yapılandırma

// Loglama seviyeleri (Numeric)
const LogLevelNumbers = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4 // Loglamayı tamamen kapatmak için
};

// String seviyeleri numeric değerlere çevirme
const getLevelNumber = (levelName) => {
  const upperLevel = String(levelName).toUpperCase();
  return LogLevelNumbers[upperLevel] ?? LogLevelNumbers.INFO; // Varsayılan INFO
};

// Merkezi log deposu (yapılandırılırsa kullanılır)
const logEntries = [];

// Logger yapılandırması (varsayılanlar)
let currentConfig = {
  level: import.meta.env.VITE_LOG_LEVEL || appConfig.system?.logging?.level || (import.meta.env.PROD ? 'WARN' : 'DEBUG'),
  enableConsole: appConfig.system?.logging?.enableConsole ?? true,
  enableMemory: appConfig.log?.enableMemory ?? !import.meta.env.PROD, // Geliştirmede hafızada tut
  maxMemoryEntries: appConfig.log?.maxMemoryEntries || 500,
  enableRemote: appConfig.log?.remote?.enabled || false,
  remoteUrl: appConfig.log?.remote?.url || null,
  remoteLevel: appConfig.log?.remote?.level || 'WARN' // Uzak sunucuya sadece WARN ve üstünü gönder
};

let currentLogLevelNumber = getLevelNumber(currentConfig.level);
let remoteLogLevelNumber = getLevelNumber(currentConfig.remoteLevel);

// Helper function to sanitize sensitive data
function sanitizeSensitiveData(data) {
  if (!data || typeof data !== 'object') return data;

  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  const sensitiveKeys = [
    'password', 'token', 'apikey', 'key', 'secret', 'authorization', 
    'auth', 'credentials', 'credential', 'accesstoken', 'refreshtoken',
    'clientsecret', 'client_secret', 'bearer' 
  ];

  function maskValue(value) {
    if (typeof value === 'string') {
      if (value.length < 4) return '***';
      if (value.length < 8) return value.substring(0, 1) + '***' + value.substring(value.length - 1);
      return value.substring(0, 2) + '****' + value.substring(value.length - 2);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value; 
    }
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'object') {
        return sanitizeSensitiveData(value);
    }
    return '[MASKED]';
  }

  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensKey => lowerKey.includes(sensKey))) {
        sanitized[key] = maskValue(sanitized[key]);
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeSensitiveData(sanitized[key]);
      }
    }
  }

  if (sanitized.headers && typeof sanitized.headers === 'object') {
    const newHeaders = {};
    for (const headerKey in sanitized.headers) {
      if (Object.prototype.hasOwnProperty.call(sanitized.headers, headerKey)) {
        const lowerHeaderKey = headerKey.toLowerCase();
        if (sensitiveKeys.some(sensKey => lowerHeaderKey.includes(sensKey) || sensKey === lowerHeaderKey)) {
          newHeaders[headerKey] = '********';
        } else {
          newHeaders[headerKey] = sanitized.headers[headerKey];
        }
      }
    }
    sanitized.headers = newHeaders;
  }
  return sanitized;
}


/**
 * Logger sınıfı
 * Her modül/bağlam için ayrı bir logger instance'ı oluşturulabilir.
 */
class Logger {
  constructor(context = 'App') {
    this.context = context;
  }

  _log(level, message, ...args) {
    const levelNumber = getLevelNumber(level);
    
    // Genel log seviyesi kontrolü
    if (levelNumber < currentLogLevelNumber) return;

    const timestamp = new Date();
    
    // Sanitize arguments before logging
    const sanitizedArgs = args.map(arg => {
      if (arg instanceof Error) {
        return { 
          name: arg.name, 
          message: arg.message, 
          stack: arg.stack?.split('\n').map(s => s.trim()) 
        };
      }
      // Apply general sanitization for other types of arguments
      return sanitizeSensitiveData(arg); 
    });

    const logEntry = {
      timestamp: timestamp.toISOString(),
      level: level.toUpperCase(),
      context: this.context,
      message,
      // args\'ı JSON\'a çevrilebilir hale getir (hataları veya DOM elemanlarını işle)
      data: sanitizedArgs
    };

    // Konsola yazdırma (yapılandırıldıysa)
    if (currentConfig.enableConsole) {
      const consoleArgs = [
        `%c[${logEntry.timestamp}] %c[${logEntry.level}] %c[${logEntry.context}]`, 
        'color: gray;', 
        `color: ${this._getLevelColor(level)}; font-weight: bold;`, 
        'color: blue;', 
        message, 
        ...sanitizedArgs
      ];
      switch (level) {
        case 'debug': console.debug(...consoleArgs); break;
        case 'info': console.info(...consoleArgs); break;
        case 'warn': console.warn(...consoleArgs); break;
        case 'error': console.error(...consoleArgs); break;
        default: console.log(...consoleArgs);
      }
    }

    // Hafızaya kaydetme (yapılandırıldıysa)
    if (currentConfig.enableMemory) {
      logEntries.push(logEntry);
      // Maksimum boyutu aşarsa eskisini sil
      if (logEntries.length > currentConfig.maxMemoryEntries) {
        logEntries.shift(); // En eski logu çıkar
      }
    }

    // Uzak sunucuya gönderme (yapılandırıldıysa ve seviye uygunsa)
    if (currentConfig.enableRemote && currentConfig.remoteUrl && levelNumber >= remoteLogLevelNumber) {
      this._sendToRemote(logEntry);
    }
  }

  debug(message, ...args) { this._log('debug', message, ...args); }
  info(message, ...args) { this._log('info', message, ...args); }
  warn(message, ...args) { this._log('warn', message, ...args); }
  error(message, ...args) { this._log('error', message, ...args); }

  _getLevelColor(level) {
    switch (level) {
      case 'debug': return '#909090';
      case 'info': return '#20a0ff';
      case 'warn': return '#ff9900';
      case 'error': return '#ff3333';
      default: return '#333333';
    }
  }

  _sendToRemote(logEntry) {
    const entryToSend = {
        ...logEntry,
        data: sanitizeSensitiveData(logEntry.data)
    };

    fetch(currentConfig.remoteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entryToSend)
    }).catch(error => {
      // Uzak loglama hatasını sadece konsola yazdır, uygulamanın akışını bozma
      console.error('[Logger] Uzak loglama sistemine gönderim hatası:', error);
    });
  }
}

// Varsayılan logger instance'ı (App context'i ile)
const defaultLogger = new Logger('App');

// Log yönetim fonksiyonları (hafıza logları için)
function getMemoryLogs() {
  return [...logEntries]; // Kopyasını döndür
}

function clearMemoryLogs() {
  logEntries.length = 0;
}

function searchMemoryLogs(searchTerm) {
    const term = String(searchTerm).toLowerCase();
    if (!term) return [];
    return logEntries.filter(log => {
        return log.message.toLowerCase().includes(term) || 
               (log.context && log.context.toLowerCase().includes(term)) ||
               (log.data && JSON.stringify(log.data).toLowerCase().includes(term));
    });
}

// Yapılandırmayı güncelleme fonksiyonu
function updateLogConfig(newConfig) {
  currentConfig = { ...currentConfig, ...newConfig };
  currentLogLevelNumber = getLevelNumber(currentConfig.level);
  remoteLogLevelNumber = getLevelNumber(currentConfig.remoteLevel);
  // logger.info('Logger yapılandırması güncellendi:', currentConfig); // Güncellenen config'i logla
}

// Fonksiyonlar
// Helper function sanitizeSensitiveData yukarı taşındı ve Logger class içinde kullanılıyor.
// Bu yüzden buradaki duplicate tanımını kaldırıyoruz;
/* 
function sanitizeSensitiveData(data) {
  // ... implementation ...
}
*/

/**
 * Güvenli loglama fonksiyonu. Hassas verileri maskeler.
 * @param {string} level - Log seviyesi (info, warn, error, debug).
 * @param {string} namespace - Log kaynağını belirten ad alanı.
 * @param {string} message - Log mesajı.
 * @param {any} [data] - Loglanacak ek veri (nesne, dizi vb.).
 */
function safeLog(level, namespace, message, data) {
  // Bu fonksiyon artık doğrudan kullanılmıyor, Logger class içindeki _log metodu
  // sanitizeSensitiveData helper'ını kullanıyor.
  // Eğer hala dışarıdan direkt safeLog çağrısı varsa, bu da güncellenmeli
  // veya Logger instance'ları üzerinden loglama yapılmalı.
  // Şimdilik bu fonksiyonun tanımını koruyalım ama idealde Logger class'ı kullanılmalı.
  const timestamp = new Date().toISOString();
  const sanitizedData = data ? sanitizeSensitiveData(data) : ''; // Sanitize here as well if called directly

  if (typeof console[level] === 'function') {
    if (sanitizedData) {
      console[level](`[${timestamp}] [${level.toUpperCase()}] [${namespace}] ${message}`, sanitizedData);
    } else {
      console[level](`[${timestamp}] [${level.toUpperCase()}] [${namespace}] ${message}`);
    }
  } else {
    // Fallback for invalid log level
    if (sanitizedData) {
      console.log(`[${timestamp}] [${level.toUpperCase()}] [${namespace}] ${message}`, sanitizedData);
    } else {
      console.log(`[${timestamp}] [${level.toUpperCase()}] [${namespace}] ${message}`);
    }
  }
}


// Dışa aktarılacak arayüz
export {
  Logger,         // Yeni instance oluşturmak için sınıf
  defaultLogger,  // Varsayılan (App) logger instance'ı
  LogLevelNumbers,// Log seviyeleri (sayısal)
  getMemoryLogs,  // Hafızadaki logları al
  clearMemoryLogs,// Hafızadaki logları temizle
  searchMemoryLogs,// Hafızadaki logları ara
  updateLogConfig // Çalışma zamanında yapılandırmayı güncelle
};

// Yaygın kullanım için varsayılan logger'ı da export et
export default defaultLogger;