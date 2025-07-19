import { ref, reactive, computed } from 'vue';
import { useStorage } from '@vueuse/core';
import axios from 'axios';
import appConfig from '@/config';
import config from '../config'; // config.js dosyasını import et
import defaultLogger from '@/utils/logger'; // Import defaultLogger
import { apiService } from '../services/api-service.js'; // Import apiService
import { orderService } from '../services/order-service.js'; // ADDED: Import orderService
import { queryDocuments } from './firebase-service'; // Firebase sorgu fonksiyonunu import et
import * as tf from '@tensorflow/tfjs'; // TensorFlow.js eklendi

// Helper function to calculate Levenshtein distance
function levenshteinDistance(s1, s2) {
  if (typeof s1 !== 'string' || typeof s2 !== 'string') {
    return Infinity; // Or handle error appropriately
  }
  s1 = s1.toUpperCase(); // Ensure case-insensitive comparison
  s2 = s2.toUpperCase();

  const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }
  return track[s2.length][s1.length];
}

// Helper function to find similar order numbers
function findSimilarOrderNos(targetOrderNo, allOrderNumbers, threshold = 2, maxSuggestions = 3) {
  if (!targetOrderNo || typeof targetOrderNo !== 'string' || !allOrderNumbers || !Array.isArray(allOrderNumbers) || allOrderNumbers.length === 0) {
    return [];
  }
  // Normalize the target order number by removing common prefixes/symbols like '#'
  const normalizedTargetOrderNo = targetOrderNo.replace(/^#/, '');

  const similar = [];
  for (const currentOrderNo of allOrderNumbers) {
    if (currentOrderNo && typeof currentOrderNo === 'string') {
      // Normalize the current order number from the list as well
      const normalizedCurrentOrderNo = currentOrderNo.replace(/^#/, '');
      const distance = levenshteinDistance(normalizedTargetOrderNo, normalizedCurrentOrderNo);
      // distance > 0 to exclude exact match if it was somehow included in allOrderNumbers after a failed primary search
      // or if we only want to suggest *other* similar ones.
      // For suggesting alternatives when primary fails, distance >= 0 might be fine if primary search is truly exhaustive.
      // Let's use distance <= threshold. If targetOrderNo itself is in allOrderNumbers with distance 0, it's fine.
      if (distance <= threshold) {
        // Store the original order number, not the normalized one, for suggestion
        similar.push({ orderNo: currentOrderNo, distance: distance });
      }
    }
  }

  // Sort by similarity (Levenshtein distance) and then alphabetically
  similar.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return a.orderNo.localeCompare(b.orderNo);
  });
  
  // Return only the order numbers of the top N suggestions
  return similar.slice(0, maxSuggestions).map(item => item.orderNo);
}

/**
 * Gelen kullanıcı sorgusunu işler, niyeti anlar ve ilgili verileri getirir.
 * @param {string} userInput Kullanıcının yazdığı metin.
 * @returns {Promise<object>} İşlenmiş sonuç, yanıt metni ve ilgili verileri içerir.
 */
export async function processChatbotQuery(userInput) {
  try {
    const lowerInput = userInput.toLowerCase();
    let intent = 'unknown';
    let entities = {};
    let needsMoreInfo = false;
    let suggestions = [];

    // Siparişle ilgili sorguları tespit et
    if (lowerInput.includes('sipariş') || /\d{5,}/.test(lowerInput)) {
      intent = 'query_order';
      const orderNoMatch = lowerInput.match(/(\d[\d\s-]*\d)/);
      if (orderNoMatch) {
        entities.orderNo = orderNoMatch[0].replace(/\s|-/g, '');
      }
    } else if (lowerInput.includes('müşteri')) {
      intent = 'query_customer';
      // Müşteri adını veya bir parçasını çıkar
      const customerNameMatch = lowerInput.split('müşteri')[1]?.trim();
      if (customerNameMatch) {
        entities.customerName = customerNameMatch;
      }
    } else if (lowerInput.includes('malzeme') || lowerInput.includes('stok')) {
      intent = 'query_material';
      // Malzeme adı veya kodu çıkarılabilir (geliştirilebilir)
      const materialMatch = lowerInput.split('malzeme')[1]?.trim() || lowerInput.split('stok')[1]?.trim();
      if (materialMatch) {
        entities.materialName = materialMatch;
      }
    }

    // Proaktif analiz tetikleyici
    const proactiveKeywords = [
      'boşta duran malzeme', 'alternatif tedarikçi', 'maliyet analizi', 'verimlilik analizi', 'teslimat tahmini', 'darboğaz', 'kalite riski', 'maliyet trendi', 'tahminsel analiz'
    ];
    if (proactiveKeywords.some(k => lowerInput.includes(k))) {
      intent = 'proactive_analysis';
    }

    // 2. Veri Çekme (Niyete göre Firebase'den)
    let queryResult = null;
    switch (intent) {
      case 'query_order':
        if (entities.orderNo) {
          queryResult = await queryDocuments('orders', { orderNo: entities.orderNo });
          if (!queryResult || queryResult.length === 0) {
            // Benzer sipariş öner
            const allOrders = await queryDocuments('orders');
            const allOrderNos = allOrders.map(o => o.orderNo);
            suggestions = findSimilarOrderNos(entities.orderNo, allOrderNos, 2, 3);
            if (suggestions.length > 0) needsMoreInfo = true;
          }
        } else if (entities.customerName) {
          queryResult = await queryDocuments('orders', { customer: entities.customerName });
          if (!queryResult || queryResult.length === 0) needsMoreInfo = true;
        } else {
          needsMoreInfo = true;
        }
        break;
      case 'query_customer':
        if (entities.customerName) {
          queryResult = await queryDocuments('customers', { name: entities.customerName });
          if (!queryResult || queryResult.length === 0) needsMoreInfo = true;
        } else {
          needsMoreInfo = true;
        }
        break;
      case 'query_material':
        if (entities.materialName) {
          queryResult = await queryDocuments('materials', { name: entities.materialName });
          if (!queryResult || queryResult.length === 0) needsMoreInfo = true;
        } else {
          needsMoreInfo = true;
        }
        break;
      case 'proactive_analysis':
        // Hangi analiz istendiğine göre fonksiyonu çağır
        if (lowerInput.includes('boşta duran')) {
          queryResult = await getIdleMaterials();
        } else if (lowerInput.includes('alternatif tedarikçi')) {
          // Malzeme kodu veya adı çıkarılabilir
          const matCode = entities.materialName || lowerInput.split('alternatif tedarikçi')[1]?.trim();
          if (matCode) queryResult = await suggestAlternativeSuppliers(matCode);
        } else if (lowerInput.includes('maliyet') || lowerInput.includes('verimlilik')) {
          queryResult = await getCostEfficiencyAnalysis();
        } else if (lowerInput.includes('tahminsel') || lowerInput.includes('teslimat') || lowerInput.includes('darboğaz') || lowerInput.includes('kalite') || lowerInput.includes('trend')) {
          queryResult = await getPredictiveAnalytics();
        }
        break;
      default:
        break;
    }

    // 3. Yanıt Oluşturma
    let responseText = "Anlayamadım, lütfen daha farklı bir şekilde sorar mısınız?";
    if (needsMoreInfo) {
      if (suggestions.length > 0) {
        responseText = `Tam olarak bulamadım. Şunlara mı bakmak istediniz? ${suggestions.join(', ')}`;
      } else {
        responseText = "Daha fazla bilgiye ihtiyacım var. Lütfen daha açık bir şekilde sorar mısınız?";
      }
    } else if (queryResult && queryResult.length > 0) {
      if (intent === 'query_order') {
        responseText = `Sipariş bulundu: ${JSON.stringify(queryResult[0], null, 2)}`;
      } else if (intent === 'query_customer') {
        responseText = `Müşteri bulundu: ${JSON.stringify(queryResult[0], null, 2)}`;
      } else if (intent === 'query_material') {
        responseText = `Malzeme bulundu: ${JSON.stringify(queryResult[0], null, 2)}`;
      } else if (intent === 'proactive_analysis' && queryResult) {
        responseText = `Proaktif analiz sonucu: ${JSON.stringify(queryResult, null, 2)}`;
      }
    } else if (intent !== 'unknown') {
      if (intent === 'query_order') {
        responseText = "İstediğiniz kriterlere uygun bir sipariş kaydı bulamadım.";
      } else if (intent === 'query_customer') {
        responseText = "İstediğiniz kriterlere uygun bir müşteri kaydı bulamadım.";
      } else if (intent === 'query_material') {
        responseText = "İstediğiniz kriterlere uygun bir malzeme kaydı bulamadım.";
      } else {
        responseText = "İstediğiniz kriterlere uygun bir kayıt bulamadım.";
      }
    }

    // Proaktif uyarı: geciken sipariş veya kritik stok varsa bildir
    if (intent === 'query_order' && (!queryResult || queryResult.length === 0)) {
      const delayed = await getDelayedOrders();
      if (delayed.length > 0) {
        responseText += `\nUyarı: Geciken siparişler var! (${delayed.map(o => o.orderNo).join(', ')})`;
      }
    }
    if (intent === 'query_material' && (!queryResult || queryResult.length === 0)) {
      const critical = await getCriticalStocks();
      if (critical.length > 0) {
        responseText += `\nUyarı: Kritik stok seviyesinde malzemeler var! (${critical.map(m => m.name).join(', ')})`;
      }
    }

    return {
      intent,
      entities,
      data: queryResult,
      suggestions,
      response: responseText,
    };

  } catch (error) {
    defaultLogger.error('Chatbot sorgu işleme hatası:', error);
    return {
      intent: 'error',
      response: 'Bir hata oluştu, lütfen daha sonra tekrar deneyin.'
    };
  }
}


// API Anahtarı ve URL Yapılandırması
const API_SERVICE_CONFIG = {
  gemini: {
    apiKey: appConfig.ai?.gemini?.apiKey || import.meta.env.VITE_GEMINI_API_KEY,
    apiUrl: appConfig.ai?.gemini?.apiUrl || 'https://generativelanguage.googleapis.com/v1beta/models',
    modelName: appConfig.ai?.gemini?.modelName || 'gemini-1.5-pro', // Varsayılan model
  },
  openRouter: {
    apiKey: appConfig.ai?.openRouter?.apiKey || import.meta.env.VITE_OPENROUTER_API_KEY, // Correctly use VITE_OPENROUTER_API_KEY
    apiUrl: appConfig.ai?.openRouter?.apiUrl || 'https://openrouter.ai/api/v1',
    defaultModels: appConfig.ai?.openRouter?.defaultModels || {
      chat: 'google/gemini-pro-1.5-exp-03-25', // config.js ile senkronize edildi
      instruct: 'google/gemini-flash-1.5',
      technical: 'google/gemini-pro-1.5-exp-03-25', // config.js ile senkronize edildi
    },
    siteUrl: appConfig.ai?.openRouter?.siteUrl,
    appName: appConfig.ai?.openRouter?.appName,
    modelApiKeys: {
      // 'deepseek/deepseek-chat-v3-0324:free': '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',
      // Model-specific keys should also be sourced from env variables if needed
      // e.g., 'some-other-model': import.meta.env.VITE_OPENROUTER_OTHER_MODEL_KEY
    }
  },
  // Diğer AI servisleri buraya eklenebilir (örn: local LLM)
};

// Reactive state for the AI service
const history = ref([]);
const isProcessing = ref(false);
const activeAiServiceRef = ref(appConfig.ai?.activeService || 'openRouter'); // Make active service reactive

// Update ACTIVE_AI_SERVICE to use the ref
const ACTIVE_AI_SERVICE = computed(() => activeAiServiceRef.value);

// Placeholder for supported models structure - adjust as needed
const supportedModels = computed(() => {
  return {
    gemini: {
      key: 'gemini',
      name: 'Gemini Pro',
      capabilities: ['chat', 'analysis'],
      service: 'gemini',
      defaultModel: API_SERVICE_CONFIG.gemini.modelName
    },
    openRouter: {
      key: 'openRouter',
      name: 'OpenRouter (DeepSeek)',
      capabilities: ['chat', 'advanced-analysis', 'multilingual'],
      service: 'openRouter',
      defaultModel: API_SERVICE_CONFIG.openRouter.defaultModels.chat
    }
    // Add other services/models here if they become available
  };
});

const getCurrentModel = () => {
  const currentServiceKey = activeAiServiceRef.value;
  if (supportedModels.value[currentServiceKey]) {
    return supportedModels.value[currentServiceKey];
  }
  // Fallback or default if the current service isn't in supportedModels
  const fallbackService = Object.keys(supportedModels.value)[0];
  return supportedModels.value[fallbackService];
};

const switchModel = (modelKeyOrServiceName) => {
  if (supportedModels.value[modelKeyOrServiceName]) {
    activeAiServiceRef.value = modelKeyOrServiceName;
    defaultLogger.info(`[AI Service] Switched model/service to: ${modelKeyOrServiceName}`);
    return true;
  } else {
    // Attempt to find by model name if not a direct service key
    for (const key in supportedModels.value) {
      if (supportedModels.value[key].name === modelKeyOrServiceName || supportedModels.value[key].defaultModel === modelKeyOrServiceName) {
        activeAiServiceRef.value = supportedModels.value[key].service;
        defaultLogger.info(`[AI Service] Switched model/service to: ${supportedModels.value[key].service} (matched by name/model)`);
        return true;
      }
    }
  }
  defaultLogger.warn(`[AI Service] Could not switch to model/service: ${modelKeyOrServiceName}. Not found.`);
  return false;
};


// Yapay zeka yanıtını işleyen fonksiyon
const parseAIResponse = (rawContent, contentType = 'application/json') => {
  console.debug(`[AI Service] parseAIResponse called with contentType: ${contentType}`);
  console.debug(`[AI Service] Raw content received for parsing: ${typeof rawContent === 'string' ? rawContent.substring(0, 200) + '...' : JSON.stringify(rawContent).substring(0,200) + '...'}`);

  if (typeof rawContent !== 'string') {
    console.warn("[AI Service] parseAIResponse: rawContent is not a string, returning as is.", rawContent);
    return rawContent; // Eğer string değilse, olduğu gibi döndür (belki zaten obje?)
  }

  let contentToParse = rawContent.trim();

  // Check for Markdown code block (e.g., ```json ... ``` or ``` ... ```)
  // Regex to match ```json ... ``` or ``` ... ``` (if language is not specified)
  // Updated regex to be more robust against potential leading/trailing whitespace within the backticks
  const markdownJsonMatch = contentToParse.match(/^```(?:json)?\\s*([\\s\\S]*?)\\s*```$/m);

  if (markdownJsonMatch && markdownJsonMatch[1]) {
    contentToParse = markdownJsonMatch[1].trim();
    console.info("[AI Service] Extracted JSON content from Markdown code block.");
  } else {
    // If the primary regex doesn't match, try to remove ```json and ``` if they exist at the start/end
    // This is a fallback for cases where the regex might be too strict or the format is slightly off
    if (contentToParse.startsWith("```json")) {
      contentToParse = contentToParse.substring(7);
      if (contentToParse.endsWith("```")) {
        contentToParse = contentToParse.substring(0, contentToParse.length - 3);
      }
      contentToParse = contentToParse.trim();
      console.info("[AI Service] Attempted to strip ```json and ``` manually.");
    } else if (contentToParse.startsWith("```") && contentToParse.endsWith("```")) {
      // For generic ``` ``` blocks
      contentToParse = contentToParse.substring(3, contentToParse.length - 3).trim();
      console.info("[AI Service] Attempted to strip generic ``` ``` manually.");
    }
  }

  // Yanıtın JSON olup olmadığını kontrol etmeye çalışalım
  // Basit bir kontrol: '{' ile başlayıp '}' ile bitiyor mu veya '[' ile başlayıp ']' ile bitiyor mu?
  const isLikelyJson = (contentToParse.startsWith('{') && contentToParse.endsWith('}')) ||
                       (contentToParse.startsWith('[') && contentToParse.endsWith(']'));

  if (contentType.includes('json') || isLikelyJson) {
    try {
      const parsed = JSON.parse(contentToParse);
      console.info("[AI Service] AI response successfully parsed as JSON.");
      return parsed;
    } catch (e) {
      console.warn(`[AI Service] Failed to parse AI response as JSON. Error: ${e.message}. Content (first 300 chars): ${contentToParse.substring(0,300)}. Returning original raw text.`);
      // JSON olarak parse edilemezse, orijinal ham metin olarak döndür (Markdown'ı koru).
      // Ancak, eğer parse hatası "Unexpected token '`'" ise, bu hala ```json blo'unun kaldığını gösterebilir.
      // Bu durumda, orijinal rawContent'i döndürmek daha güvenli olabilir.
      if (e.message.includes("Unexpected token '`'")) {
        console.warn("[AI Service] JSON parse error likely due to remaining backticks. Returning original raw content.");
        return rawContent.trim(); // Return the original raw string if backticks are still an issue
      }
      return contentToParse; // Return the cleaned content if parsing failed for other reasons
    }
  } else {
    // JSON değilse (örneğin text/plain, text/markdown), ham metin olarak döndür.
    console.info(`[AI Service] AI response is not JSON (contentType: ${contentType}, isLikelyJson: ${isLikelyJson}). Returning raw text.`);
    return rawContent.trim();
  }
};

// --- GENEL API İSTEK FONKSİYONU ---
const makeApiRequest = async (serviceName, endpoint, payload, method = 'POST') => {
  const serviceConfig = API_SERVICE_CONFIG[serviceName];
  if (!serviceConfig || !serviceConfig.apiKey || !serviceConfig.apiUrl) {
    console.warn(`${serviceName} API anahtarı veya URL bulunamadı. Demo mod kullanılıyor.`);
    return simulateAIResponse(payload.contents ? payload.contents[0]?.parts[0]?.text : payload.messages?.[payload.messages.length - 1]?.content);
  }

  let effectiveApiKey;
  let referer = serviceConfig.siteUrl || 'http://localhost:5173'; // Default referer
  let title = serviceConfig.appName || 'METS AI Assistant';

  if (serviceName === 'openRouter') {
    // Always use the general API key from .env for OpenRouter unless a model-specific
    // key is explicitly defined AND sourced from an environment variable.
    // The previous logic for modelApiKeys could lead to hardcoded keys being used.
    effectiveApiKey = serviceConfig.apiKey || import.meta.env.VITE_OPENROUTER_API_KEY;
    defaultLogger.info(`[AI Service] Using API key for OpenRouter. Model: ${payload ? payload.model : 'N/A'}`);

    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
      const hostname = window.location.hostname;
      const origin = window.location.origin;

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        referer = origin;
      } else {
        referer = serviceConfig.siteUrl || origin;
      }
    }
  } else if (serviceName === 'gemini') {
    effectiveApiKey = serviceConfig.apiKey || import.meta.env.VITE_GEMINI_API_KEY;
  } else {
    effectiveApiKey = serviceConfig.apiKey;
  }

  if (!effectiveApiKey) {
    console.error(`[AI Service] API Key not found for service: ${serviceName} and model: ${payload ? payload.model : 'N/A'}`);
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (serviceName === 'openRouter') {
    if (effectiveApiKey) {
      headers['Authorization'] = `Bearer ${effectiveApiKey}`;
    }
    headers['HTTP-Referer'] = referer;
    headers['X-Title'] = title;
  }

  defaultLogger.info(`[AI Service] makeApiRequest - Service: ${serviceName}, Model: ${payload?.model}`);
  defaultLogger.info(`[AI Service] makeApiRequest - API Key being used: ${effectiveApiKey ? 'Anahtar Yüklendi (gizlendi)' : 'API Anahtarı BULUNAMADI!'}`);
  defaultLogger.info('[AI Service] makeApiRequest - Request Headers:', headers); // Use defaultLogger here
  defaultLogger.info('[AI Service] makeApiRequest - Request Data:', payload); // Use defaultLogger here

  try {
    const response = await axios({
      method,
      url: `${serviceConfig.apiUrl}/${endpoint}`,
      data: payload,
      headers,
    });

    if (response.data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return {
        text: response.data.candidates[0].content.parts[0].text,
        success: true,
        raw: response.data,
        source: serviceName,
      };
    }
    if (response.data.choices?.[0]?.message?.content) {
      return {
        text: response.data.choices[0].message.content,
        success: true,
        raw: response.data,
        source: serviceName,
      };
    }
    throw new Error('API yanıtından metin alınamadı veya format tanınmıyor');
  } catch (error) {
    console.error(`${serviceName} API hatası:`, error.response?.data || error.message);
    const demoResponse = await simulateAIResponse(
      payload.contents ? payload.contents[0]?.parts[0]?.text : payload.messages?.[payload.messages.length - 1]?.content, 
      serviceName, 
      error.response?.data || error.message
    );
    history.value.push({
      role: 'assistant',
      content: demoResponse.text,
      source: demoResponse.source,
      isDemo: true,
      timestamp: new Date()
    });
    return demoResponse;
  }
};

// --- GEMINI ÖZEL FONKSİYONLARI ---
const geminiGenerateContent = async (prompt, options = {}) => {
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? config.ai?.geminiGenerationConfig?.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? config.ai?.geminiGenerationConfig?.maxOutputTokens ?? 2048,
      topP: options.topP ?? config.ai?.geminiGenerationConfig?.topP ?? 0.8,
      topK: options.topK ?? config.ai?.geminiGenerationConfig?.topK ?? 40,
    },
    safetySettings: config.ai?.geminiSafetySettings || [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };
  return makeApiRequest('gemini', `${API_SERVICE_CONFIG.gemini.modelName}:generateContent`, payload);
};

const geminiChat = async (messages, options = {}) => {
  const formattedMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const payload = {
    contents: formattedMessages,
    generationConfig: {
      temperature: options.temperature ?? config.ai?.gemini?.generationConfig?.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? config.ai?.gemini?.generationConfig?.maxOutputTokens ?? 2048,
      topP: options.topP ?? config.ai?.gemini?.generationConfig?.topP ?? 0.8,
      topK: options.topK ?? config.ai?.gemini?.generationConfig?.topK ?? 40,
    },
    safetySettings: config.ai?.gemini?.safetySettings, 
  };

  return makeApiRequest('gemini', payload);
};

// --- OPENROUTER ÖZEL FONKSİYONLARI ---
const openRouterChatCompletion = async (messages, options = {}) => {
  const model = options.model || API_SERVICE_CONFIG.openRouter.defaultModels.chat;
  const formattedMessages = messages.map(msg => {
    if (msg.content && typeof msg.content === 'string' && msg.image_url) {
      return {
        role: msg.role,
        content: [
          {
            type: "text",
            text: msg.content
          },
          {
            type: "image_url",
            image_url: { url: msg.image_url }
          }
        ]
      };
    }
    return { role: msg.role, content: msg.content };
  });

  const payload = {
    model: model,
    messages: formattedMessages,
    temperature: options.temperature ?? appConfig.ai?.openRouter?.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? appConfig.ai?.openRouter?.maxTokens ?? 2048,
    top_p: options.topP ?? appConfig.ai?.openRouter?.topP ?? 0.8,
  };
  return makeApiRequest('openRouter', 'chat/completions', payload);
};

// --- DEMO MODU İÇİN YANIT SİMÜLASYONU ---
const simulateAIResponse = async (prompt, service = 'Demo AI', errorInfo = null) => {
  console.log(`Demo mod (${service}): AI yanıtı simüle ediliyor. Hata: ${errorInfo ? JSON.stringify(errorInfo) : 'Yok'}`);
  isProcessing.value = true;
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
  
  let responseText = `Üzgünüm, \"${prompt?.substring(0, 50)}...\" ile ilgili isteğinizi işlerken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.`;
  if (errorInfo) {
    responseText = `API bağlantı sorunu (${service}): ${JSON.stringify(errorInfo)}. Geliştirici konsolunu kontrol edin. Demo yanıt üretiliyor.`;
  }

  if (prompt) {
    const p = prompt.toLowerCase();
    if (p.includes('üretim') || p.includes('imalat')) {
      responseText = 'Demo: Üretim planı %95 tamamlanma oranına sahip. Kalan işler için tahmini süre 2 gün.';
    } else if (p.includes('stok') || p.includes('malzeme')) {
      responseText = 'Demo: Kritik stok seviyesindeki malzemeler: Röle X (10 adet kaldı), Kablo Y (25m kaldı). Siparişleri verildi.';
    } else if (p.includes('sipariş') || p.includes('satış')) {
      responseText = 'Demo: Son 24 saatte 5 yeni sipariş alındı. En büyük sipariş ABC firmasından (15 hücre).';
    } else if (p.includes('merhaba') || p.includes('selam')) {
      responseText = 'Demo: Merhaba! Size nasıl yardımcı olabilirim?';
    } else {
      responseText = `Demo: \"${prompt.substring(0, 60)}...\" sorgunuz için genel bir demo yanıtı üretildi. Gerçek veri için lütfen API bağlantısını kontrol edin.`;
    }
  }

  isProcessing.value = false;
  return {
    text: responseText,
    success: false,
    source: service,
    isDemo: true,
  };
};

// API anahtarlarının saklandığı bölümü güncelleyin
function getApiKeyForModel(modelName) {
  // .env dosyasından anahtarları alın (Vite için import.meta.env)
  const envApiKeys = {
    'deepseek/deepseek-chat-v3-0324:free': import.meta.env.VITE_OPENROUTER_API_KEY,
    // Diğer modeller için anahtarlar eklenebilir
    // 'another-model': import.meta.env.VITE_ANOTHER_MODEL_API_KEY,
  };
  
  const apiKey = envApiKeys[modelName];
  if (!apiKey) {
    logger.warn('AIService', `API key for model ${modelName} not found in .env.VITE_OPENROUTER_API_KEY. Ensure it is configured.`);
  }
  return apiKey;
}

// --- DIŞA AKTARILAN SERVİS FONKSİYONLARI ---
export const aiService = {
  sendMessage: async (messageContent, currentAppContext = null, options = {}) => { // Modified signature
    isProcessing.value = true;
    try { 
      let currentMessagePayload;

      if (typeof messageContent === 'string') {
        currentMessagePayload = { role: 'user', content: messageContent };
      } else if (typeof messageContent === 'object' && messageContent.text) {
        currentMessagePayload = {
          role: 'user',
          content: messageContent.text,
          ...(messageContent.image_url && { image_url: messageContent.image_url })
        };
      } else {
        console.error('Invalid messageContent format:', messageContent);
      }

      history.value.push({ 
          role: currentMessagePayload.role, 
          content: currentMessagePayload.content, 
          ...(currentMessagePayload.image_url && { image_url: currentMessagePayload.image_url }),
          timestamp: new Date() 
      });

      // Önce doğrudan işleme mantığını çalıştır
      const directQueryResult = await processChatbotQuery(currentMessagePayload.content);

      // Doğrudan mantık bir sonuç ürettiyse, LLM'ye gitmeden yanıt ver
      if (directQueryResult.intent !== 'unknown' && directQueryResult.intent !== 'error') {
        const assistantResponse = {
          role: 'assistant',
          content: directQueryResult.response,
          source: `Veritabanı (${directQueryResult.intent})`,
          timestamp: new Date(),
          data: directQueryResult.data
        };
        history.value.push(assistantResponse);
        return; // İşlemi burada bitir
      }


      let messagesForApi = [];
      const systemPrompt = `Sen MehmetEndustriyelTakip (METS) uygulaması için bir asistansın. Görevin, kullanıcının METS ERP sistemiyle ilgili sorularını yanıtlamaktır.
HER ZAMAN aşağıdaki JSON formatında Türkçe olarak yanıt ver:
{
  "status": "success" | "order_found" | "order_not_found" | "similar_orders_found" | "general_query_unsupported" | "error" | "ambiguous_query",
  "message": "AI'nın Türkçe yanıtı.",
  "data": {
    "orderNo": "string (eğer varsa)",
    "orderDetails": {},
    "similarOrders": [], // Değişiklik: Artık her zaman bir dizi olacak, string değil.
    "originalQuery": "string (eğer varsa)"
  },
  "errorDetails": "string (eğer varsa)"
}

status alanının olası değerleri ve anlamları:
- "order_found": Sipariş başarıyla bulundu ve detayları 'data.orderDetails' içinde. 'message' içinde kullanıcıya bilgi ver.
- "order_not_found": Sipariş bulunamadı. 'data.orderNo' aranan numarayı içerebilir. 'message' içinde kullanıcıya siparişin bulunamadığını belirt.
- "similar_orders_found": Tam eşleşme bulunamadı ama benzer siparişler var. 'data.orderNo' aranan numarayı, 'data.similarOrders' benzer numaraları (JSON dizisi olarak) içerir. 'message' içinde kullanıcıya bunları sor.
- "general_query_unsupported": Kullanıcı genel bir soru sordu (sipariş numarası olmadan liste, analiz vb.). 'message' içinde bu tür sorguların desteklenmediğini belirt.
- "error": Bir sistem hatası oluştu. 'message' içinde kullanıcıya genel bir hata mesajı ver. 'errorDetails' teknik detayı içerebilir.
- "ambiguous_query": Kullanıcının sorgusu belirsiz. 'message' içinde daha fazla bilgi iste. 'data.originalQuery' kullanıcının sorgusunu içerebilir.
- "success": Diğer başarılı genel yanıtlar için (örn: selamlama). 'message' yanıtı içerir.

ÇOK ÖNEMLİ DAVRANIŞ KURALLARI:
1.  Eğer konuşma geçmişinde "Sistemden alınan sipariş bilgileri ({siparisNo}): {JSON_VERISI}" şeklinde bir mesaj varsa ve kullanıcı o siparişle ilgili soru soruyorsa:
    *   status: "order_found"
    *   message: "{siparisNo} numaralı siparişle ilgili bilgiler..." (JSON_VERISI'nden özetle)
    *   data.orderNo: "{siparisNo}"
    *   data.orderDetails: {JSON_VERISI} içindeki ilgili alanlar (örn: müşteri, durum, tarih, miktar, hücre tipi).
    *   JSON verisinde olmayan bir bilgiyi KESİNLİKLE UYDURMA. Eğer JSON verisi kullanıcının sorusunu tam karşılamıyorsa, 'message' içinde "Sağlanan bilgilerde bu detay bulunmuyor." gibi bir ifade kullan.
2.  Eğer konuşma geçmişinde "Sistem Notu: '{siparisNo}' numaralı sipariş sistemde bulunamadı." şeklinde bir mesaj varsa ve kullanıcı o siparişle ilgili soru soruyorsa:
    *   status: "order_not_found"
    *   message: "Belirttiğiniz '{siparisNo}' numaralı sipariş sistemde bulunamadı."
    *   data.orderNo: "{siparisNo}"
    *   KESİNLİKLE sipariş detayı UYDURMA.
3.  Eğer konuşma geçmişinde "Sistem Notu: '{arananSiparisNo}' numaralı sipariş tam olarak bulunamadı. Ancak şunlara benzer siparişler mevcut: {benzerSiparislerListesiAsJsonStringArray}. Bu siparişlerden birini mi demek istediniz?" şeklinde bir mesaj varsa:
    *   status: "similar_orders_found"
    *   message: (Sistem mesajını olduğu gibi kullanın, örneğin: "'{arananSiparisNo}' numaralı sipariş tam olarak bulunamadı. Ancak şunlara benzer siparişler mevcut: ["#2505-FS","#2505-BX"]. Bu siparişlerden birini mi demek istediniz?")
    *   data.orderNo: "{arananSiparisNo}"
    *   data.similarOrders: (Sistem Notunda JSON dizi string formatında verilen benzer sipariş numaralarını PARSE EDEREK GERÇEK BİR JSON DİZİSİ olarak kullanın. Örn: ["#Siparis1", "Siparis2"])
4.  Kullanıcı belirli bir sipariş numarası VERMEDEN genel bir soru sorarsa (örneğin "aktif siparişleri listeler misin?", "KEE Enerji'nin siparişleri nelerdir?"):
    *   status: "general_query_unsupported"
    *   message: "Şu anda yalnızca belirli bir sipariş numarasını sorgulayarak detay getirebiliyorum. Genel listeleme veya analiz yapma yeteneğim henüz bulunmuyor."
    *   Bu tür genel sorular için KESİNLİKLE liste veya detay UYDURMA.
5.  Eğer konuşma geçmişinde "Sistem Hatası: {siparisNo} numaralı sipariş detayları getirilirken ... Hata: {HATA_MESAJI}. Kullanıcıya teknik bir sorun olduğunu ve daha sonra tekrar denemesi gerektiğini belirtin." şeklinde bir sistem mesajı varsa:
    *   status: "error"
    *   message: "{siparisNo} için bilgi alınırken bir sorunla karşılaşıldı. Lütfen daha sonra tekrar deneyiniz."
    *   data.orderNo: "{siparisNo}" (eğer varsa)
    *   errorDetails: "{HATA_MESAJI}" (eğer varsa)
    *   KESİNLİKLE varsayımsal bilgi üretme veya soruyu farklı bir şekilde yanıtlamaya çalışma.
6.  Kullanıcının sorusunu yanıtlarken, eğer bir sipariş numarası, müşteri adı, ürün kodu gibi spesifik tanımlayıcılar geçerse, sistemden bu tanımlayıcılara uygun bilgi getirilip getirilmediğini kontrol et (yukarıdaki 1., 2. ve 3. maddelere bak). Ona göre cevap ver.
7.  Cevaplarında sadece istenen bilgiyi ver, varsayım yapma, genel veya alakasız bilgiler verme.
8.  Kullanıcı "merhaba", "selam" gibi bir selamlama yaparsa:
    *   status: "success"
    *   message: "Merhaba! Size METS ERP sistemi ile ilgili nasıl yardımcı olabilirim?"
9.  Kullanıcının sorgusu belirsizse veya ne istediği tam anlaşılmıyorsa:
    *   status: "ambiguous_query"
    *   message: "Sorgunuzu tam olarak anlayamadım. Sipariş numarası belirterek veya sorunuzu biraz daha detaylandırarak tekrar deneyebilir misiniz?"
    *   data.originalQuery: "{kullanıcının orijinal sorgusu}"
10. YANITINDA JSON DIŞINDA HİÇBİR AÇIKLAMA, GİRİŞ VEYA SONUÇ CÜMLESİ KULLANMA. SADECE İSTENEN JSON FORMATINDA ÇIKTI VER.`
      
      messagesForApi.push({ role: 'system', content: systemPrompt });

      // Attempt to fetch order data if an order number is mentioned
      let orderDataSystemMessage = null;
      
      // Trim the message content first
      const trimmedMessageContent = currentMessagePayload.content.trim();
      defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Trimmed message content: \"${trimmedMessageContent}\" (Type: ${typeof trimmedMessageContent})`);

      // Define the comprehensive order number pattern (without \\b for more flexibility)
      // Groups: 1: (FS style, e.g., 2505-FS), 2: (SIP style, e.g., SIP-12345), 3: (order style, e.g., order-001), 4: (numeric, e.g., 2505)
      const orderNoPattern = /([A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)*)|(SIP-\\d+)|(order-\\d+)|((?<![A-Za-z0-9-])\\d{4,}(?![A-Za-z0-9-]))/i;
      defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Attempting to match orderNoPattern against content: \"${trimmedMessageContent}\"`);
      
      let orderNoMatchInMessage = null;
      if (typeof trimmedMessageContent === 'string') {
        orderNoMatchInMessage = trimmedMessageContent.match(orderNoPattern);
      } else {
        defaultLogger.warn(`[AI SERVICE CONSOLE DEBUG] trimmedMessageContent is not a string, skipping regex match. Type: ${typeof trimmedMessageContent}`);
      }
      defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Result of orderNoPattern.match on content: ${JSON.stringify(orderNoMatchInMessage)}`);

      let extractedOrderNo = null;
      if (orderNoMatchInMessage) {
        // Prioritize the first non-null captured group
        extractedOrderNo = (orderNoMatchInMessage[1] || orderNoMatchInMessage[2] || orderNoMatchInMessage[3] || orderNoMatchInMessage[4])?.toUpperCase();
        defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Extracted from orderNoMatchInMessage: ${extractedOrderNo}`);
      }

      // If no match from the general pattern, or if the message is short (heuristic),
      // try to match the entire content as an order number.
      // This is especially for cases where the user just types the order number, e.g., "2505-FS".
      if (!extractedOrderNo && trimmedMessageContent.length < 30) { 
          defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] No match from pattern or message is short, trying full content match. Content: \"${trimmedMessageContent}\"`);
          const fsStyleFullMatch = trimmedMessageContent.match(/^([A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)*)$/i);
          const sipStyleFullMatch = trimmedMessageContent.match(/^(SIP-\\d+)$/i);
          const orderStyleFullMatch = trimmedMessageContent.match(/^(order-\\d+)$/i);
          const numericStyleFullMatch = trimmedMessageContent.match(/^(\\d{4,})$/i); // ADDED numeric check for full content

          if (fsStyleFullMatch && fsStyleFullMatch[1]) {
            extractedOrderNo = fsStyleFullMatch[1].toUpperCase();
            defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Extracted from fsStyleFullMatch: ${extractedOrderNo}`);
          } else if (sipStyleFullMatch && sipStyleFullMatch[1]) {
            extractedOrderNo = sipStyleFullMatch[1].toUpperCase();
            defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Extracted from sipStyleFullMatch: ${extractedOrderNo}`);
          } else if (orderStyleFullMatch && orderStyleFullMatch[1]) {
            extractedOrderNo = orderStyleFullMatch[1].toUpperCase();
            defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Extracted from orderStyleFullMatch: ${extractedOrderNo}`);
          } else if (numericStyleFullMatch && numericStyleFullMatch[1]) { // ADDED full content numeric check
            extractedOrderNo = numericStyleFullMatch[1].toUpperCase();
            defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Extracted from numericStyleFullMatch: ${extractedOrderNo}`);
          } else {
            defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Full content match also failed for short message.`);
          }
      }
      
      if (extractedOrderNo) {
          defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Extracted order number: ${extractedOrderNo} from message: \\"${currentMessagePayload.content}\\"`);
          try {
            defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Calling orderService.getOrderByNumber with: \\"${extractedOrderNo}\\"`);
            // MODIFIED: Use getOrderByNumber and expect a single object or null
            let orderDetails = await orderService.getOrderByNumber(extractedOrderNo); 
            defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Initial orderDetails for ${extractedOrderNo} from orderService.getOrderByNumber: ${JSON.stringify(orderDetails)}`);

            // If not found, and it doesn't already start with #, try with # prefix.
            if (!orderDetails && extractedOrderNo && !extractedOrderNo.startsWith('#')) {
                const prefixedOrderNo = "#" + extractedOrderNo;
                defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Order ${extractedOrderNo} not found. Trying with # prefix as ${prefixedOrderNo}.`);
                // MODIFIED: Use getOrderByNumber for the prefixed version as well
                orderDetails = await orderService.getOrderByNumber(prefixedOrderNo);
                if (orderDetails) {
                    defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Order found with # prefix: ${prefixedOrderNo}. Details: ${JSON.stringify(orderDetails)}`);
                } else {
                    defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Order also not found with # prefix: ${prefixedOrderNo}.`);
                }
            }
            
            defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Final orderDetails for (original/prefixed) ${extractedOrderNo}: ${JSON.stringify(orderDetails)}`);

            if (orderDetails && Object.keys(orderDetails).length > 0) {
              const relevantOrderDetails = {
                id: orderDetails.id,
                orderNo: orderDetails.orderNo, // This is the definitive one from DB, e.g., #2505-FS
                customer: orderDetails.customer,
                status: orderDetails.status,
                date: orderDetails.date,
                quantity: orderDetails.quantity,
                cellType: orderDetails.cellType,
                // Add other fields if necessary, but keep it concise
              };
              Object.keys(relevantOrderDetails).forEach(key => relevantOrderDetails[key] === undefined && delete relevantOrderDetails[key]);
              
              orderDataSystemMessage = {
                role: 'system',
                // Use relevantOrderDetails.orderNo here as it's the definitive one from DB
                content: `Sistemden alınan sipariş bilgileri (${relevantOrderDetails.orderNo}): ${JSON.stringify(relevantOrderDetails)}`
              };
              defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Order details found for ${relevantOrderDetails.orderNo}. orderDataSystemMessage created.`);
            } else {
              // EXACT MATCH NOT FOUND (even with prefix) - TRY TO FIND SIMILAR ORDERS
              defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Exact match for ${extractedOrderNo} (and potential prefixed version) not found. Attempting to find similar orders.`);
              let similarOrdersFound = [];
              try {
                if (typeof orderService.getAllOrderNumbers === 'function') {
                  const allOrderNumbers = await orderService.getAllOrderNumbers();
                  if (allOrderNumbers && Array.isArray(allOrderNumbers) && allOrderNumbers.length > 0) {
                    defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Fetched ${allOrderNumbers.length} order numbers for similarity check (target: ${extractedOrderNo}).`);
                    // findSimilarOrderNos normalizes internally for comparison, but uses original for suggestions
                    similarOrdersFound = findSimilarOrderNos(extractedOrderNo, allOrderNumbers, 2, 3); 
                  } else {
                    defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] orderService.getAllOrderNumbers returned no data, not an array, or empty array.`);
                  }
                } else {
                  defaultLogger.warn(`[AI SERVICE CONSOLE DEBUG] orderService.getAllOrderNumbers is not a function. Cannot perform similarity search.`);
                }
              } catch (err) {
                defaultLogger.error(`[AI SERVICE CONSOLE DEBUG] Error during similarity search: ${err.message}`, err);
              }

              if (similarOrdersFound.length > 0) {
                orderDataSystemMessage = {
                  role: 'system',
                  // Pass the original extractedOrderNo (what user asked for) and the list of similar orders as a JSON string array
                  content: `Sistem Notu: '${extractedOrderNo}' numaralı sipariş tam olarak bulunamadı. Ancak şunlara benzer siparişler mevcut: ${JSON.stringify(similarOrdersFound)}. Bu siparişlerden birini mi demek istediniz?`
                };
                defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Similar orders found for ${extractedOrderNo}: ${JSON.stringify(similarOrdersFound)}. Suggestion message created.`);
              } else {
                orderDataSystemMessage = {
                  role: 'system',
                  content: `Sistem Notu: ${extractedOrderNo} numaralı sipariş sistemde bulunamadı.`
                };
                defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Order details NOT FOUND for ${extractedOrderNo} and no similar orders found. Standard "not found" system message created.`);
              }
            }
          } catch (error) {
            defaultLogger.error(`[AI SERVICE CONSOLE DEBUG] Error fetching order details or finding similar orders for ${extractedOrderNo}:`, error);
            orderDataSystemMessage = {
              role: 'system',
              content: `Sistem Notu: ${extractedOrderNo} numaralı sipariş alınırken veya benzerleri aranırken bir hata oluştu: ${error.message}`
            };
            defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] Error fetching/searching order details for ${extractedOrderNo}. Error system message created.`);
          }
      } else {
          defaultLogger.info(`[AI SERVICE CONSOLE DEBUG] No order number pattern matched or extracted from message: \"${currentMessagePayload.content}\"`);
          // The AI's general instructions (rule 3) should guide its response if no order number is found
          // and the query is general.
      }

      if (orderDataSystemMessage) {
        messagesForApi.push(orderDataSystemMessage);
      }

      const historyForApi = history.value.map((msg, index) => {
        if (index === history.value.length - 1 && msg.role === 'user' && currentAppContext && currentAppContext.view) {
          let userMessageWithContext = msg.content;
          let contextString = `[Kullanıcının mevcut uygulama ekranı: ${currentAppContext.view}`;
          if (currentAppContext.params && Object.keys(currentAppContext.params).length > 0) {
            contextString += `, Parametreler: ${JSON.stringify(currentAppContext.params)}`;
          }
          contextString += ']';
          userMessageWithContext = `${msg.content} ${contextString}`;
          return { ...msg, content: userMessageWithContext };
        }
        return msg;
      });

      historyForApi.forEach(msg => {
        if (msg.role !== 'system') { // Only push non-system messages from history, as system prompt is already added
            messagesForApi.push(msg);
        }
      });

      let response;
      if (ACTIVE_AI_SERVICE.value === 'gemini') {
        response = await geminiChat(messagesForApi, options);
      } else if (ACTIVE_AI_SERVICE.value === 'openRouter') {
        response = await openRouterChatCompletion(messagesForApi, options);
      } else {
        console.warn(`[AI Service] Unknown AI service: ${ACTIVE_AI_SERVICE.value}. Simulating response.`);
        response = await simulateAIResponse(currentMessagePayload.content, "Unknown Service");
      }

      if (response && response.text) {
        const aiResponseContent = parseAIResponse(response.text); 
        history.value.push({
          role: 'assistant',
          content: typeof aiResponseContent === 'string' ? aiResponseContent : JSON.stringify(aiResponseContent), 
          source: response.source,
          isDemo: response.isDemo || false,
          timestamp: new Date()
        });
      }
      return response;
    } finally { 
      isProcessing.value = false;
    }
  },

  ask: async (prompt, options = {}) => {
    isProcessing.value = true; 
    try { 
      if (ACTIVE_AI_SERVICE.value === 'gemini') {
        return await geminiGenerateContent(prompt, options);
      } else if (ACTIVE_AI_SERVICE.value === 'openRouter') {
        const messages = [{ role: 'user', content: prompt }];
        const askModel = API_SERVICE_CONFIG.openRouter.defaultModels.instruct || API_SERVICE_CONFIG.openRouter.defaultModels.chat;
        return await openRouterChatCompletion(messages, { ...options, model: askModel });
      } else {
        console.warn(`[AI Service] Unknown AI service for 'ask': ${ACTIVE_AI_SERVICE.value}. Simulating response.`);
        return await simulateAIResponse(prompt, "Unknown Service");
      }
    } finally {
      isProcessing.value = false; 
    }
  },

  getInsights: async (options = {}) => {
    isProcessing.value = true;
    let insightsData = null;
    const insightsSystemPrompt = `Sen bir endüstriyel üretim ve planlama uzmanısın. Sağlanan verilere dayanarak METS ERP sistemi için içgörüler oluştur.
Yanıtını SADECE bir JSON dizisi (array) olarak döndür. Bu dizi, her biri aşağıdaki alanları içeren objelerden oluşmalıdır:
- id: string (benzersiz bir kimlik)
- title: string (içgörünün başlığı)
- description: string (içgörünün detaylı açıklaması)
- category: string (örneğin; 'üretim', 'stok', 'kalite', 'analiz', 'bakım', 'planlama')
- importance: string ('high', 'medium', 'low')
- department: string (ilgili departman)
- date: string (ISO 8601 formatında tarih)
- predictions: array (her biri 'name', 'value', 'type', 'status' içeren obje dizisi. Tahmin yoksa boş dizi.)
- actions: array (string dizisi olarak önerilen aksiyonlar. Aksiyon yoksa boş dizi.)

Örnek bir obje:
{
  "id": "INS001",
  "title": "Kritik Stok Seviyesi Uyarısı",
  "description": "ABC malzemesi kritik stok seviyesinin altına düştü. Üretimde aksama yaşanmaması için acil tedarik gerekiyor.",
  "category": "stok",
  "importance": "high",
  "department": "Satınalma",
  "date": "2024-05-15T10:30:00Z",
  "predictions": [
    { "name": "Stok Tükenme Tarihi", "value": "2024-05-18", "type": "date", "status": "warning" }
  ],
  "actions": ["Acil olarak ABC malzemesi siparişi ver.", "Alternatif tedarikçileri kontrol et."]
}

Başka hiçbir metin, açıklama, Markdown formatlaması veya \\\`\\\`\\\`json ... \\\`\\\`\\\` sarmalayıcıları EKLEME. Sadece ham JSON dizisini döndür. Dizide birden fazla içgörü objesi olabilir. Eğer hiç içgörü yoksa, boş bir JSON dizisi [] döndür.`;

    try {
      const modelForInsights = API_SERVICE_CONFIG.openRouter.defaultModels.technical || API_SERVICE_CONFIG.openRouter.defaultModels.chat;
      const messages = [
        { role: 'system', content: insightsSystemPrompt },
        { role: 'user', content: "Lütfen mevcut sistem verilerine göre içgörüleri oluştur." }
      ];

      let response;
      if (ACTIVE_AI_SERVICE.value === 'gemini') {
        response = await geminiChat(messages, { ...options, temperature: 0.3, maxTokens: 3000 });
      } else if (ACTIVE_AI_SERVICE.value === 'openRouter') {
        response = await openRouterChatCompletion(messages, { ...options, model: modelForInsights, temperature: 0.3, maxTokens: 3000 });
      } else {
        defaultLogger.warn(`[AI Service] getInsights: Aktif AI servisi (${ACTIVE_AI_SERVICE.value}) desteklenmiyor veya bilinmiyor. Demo veri kullanılacak.`);
        insightsData = aiService.getDemoInsights(); 
        return insightsData;
      }

      if (response && response.text) {
        const parsedInsights = parseAIResponse(response.text);
        if (Array.isArray(parsedInsights)) {
          defaultLogger.info(`[AI Service] getInsights: Successfully processed insights as an array. (${parsedInsights.length})`, parsedInsights.slice(0,2));
          insightsData = parsedInsights;
        } else {
          defaultLogger.warn('[AI Service] getInsights: Insights response was not a valid JSON array after parsing. Response text:', response.text.substring(0, 500));
          insightsData = aiService.getDemoInsights(); 
        }
      } else {
        defaultLogger.warn('[AI Service] getInsights: No text in AI response or response was null. Using demo data.');
        insightsData = aiService.getDemoInsights(); 
      }
    } catch (error) {
      defaultLogger.error('[AI Service] getInsights: Error fetching or processing insights:', error);
      insightsData = aiService.getDemoInsights(); 
    } finally {
      isProcessing.value = false;
    }
    return insightsData;
  },

  analyzeDocument: async (documentFile, options = {}) => {
    isProcessing.value = true;
    try {
      defaultLogger.info(`[AI Service] analyzeDocument called for file: ${documentFile ? documentFile.name : 'N/A'}`);
      if (!documentFile || typeof documentFile.text !== 'function') {
        defaultLogger.error('[AI Service] analyzeDocument: Invalid documentFile object or missing text() method.');
        return { success: false, error: 'Invalid document file.' };
      }

      const fileContent = await documentFile.text(); 
      const prompt = `Lütfen aşağıdaki belge içeriğini analiz et ve özetle. Önemli noktaları, anahtar kelimeleri ve olası eylemleri belirt:\\n\\n${fileContent.substring(0, 15000)}`; 

      const response = await aiService.ask(prompt, { ...options, maxTokens: 1024 }); 

      if (response && response.success) {
        defaultLogger.info(`[AI Service] analyzeDocument: Successfully analyzed document ${documentFile.name}`);
        return { success: true, analysis: response.text, source: response.source };
      } else {
        defaultLogger.warn(`[AI Service] analyzeDocument: Failed to analyze document ${documentFile.name}. Demo response used or error occurred.`);
        return { success: false, error: response?.error || 'Analysis failed.', analysis: response?.text, source: response?.source, isDemo: response?.isDemo };
      }
    } catch (error) {
      defaultLogger.error(`[AI Service] analyzeDocument: Exception during analysis of ${documentFile ? documentFile.name : 'N/A'}:`, error);
      return { success: false, error: error.message, analysis: `Belge analizi sırasında bir hata oluştu: ${error.message}` };
    } finally {
      isProcessing.value = false; // Ensure isProcessing is reset
    }
  },
  // Expose reactive properties and methods needed by components
  history: computed(() => history.value),
  isProcessing: computed(() => isProcessing.value),
  activeAiService: ACTIVE_AI_SERVICE, // Expose the computed active service
  supportedModels: supportedModels, // Expose supported models
  getCurrentModel: getCurrentModel, // Expose function to get current model details
  switchModel: switchModel, // Expose function to switch model/service

  setActiveAiService: (serviceName) => {
    if (API_SERVICE_CONFIG[serviceName]) {
      activeAiServiceRef.value = serviceName;
      defaultLogger.info(`[AI Service] Active AI service changed to: ${serviceName}`);
    } else {
      defaultLogger.warn(`[AI Service] Attempted to set unknown AI service: ${serviceName}`);
    }
  },

  clearHistory: () => {
    history.value = [];
    defaultLogger.info('[AI Service] Chat history cleared.');
  },

  // Get current configuration (useful for debugging or UI display)
  getCurrentConfig: () => {
    return {
      activeService: ACTIVE_AI_SERVICE.value,
      config: API_SERVICE_CONFIG[ACTIVE_AI_SERVICE.value]
    };
  },
   getDemoInsights: () => { // Ensure getDemoInsights is part of the exported object or defined globally
    // Placeholder for demo insights, adapt as needed
    return [
      { id: 'demo1', title: 'Demo Insight 1', description: 'This is a demo insight.', category: 'üretim', importance: 'high', department: 'Planlama', date: new Date().toISOString(), predictions: [], actions: ['Review production schedule'] },
      { id: 'demo2', title: 'Demo Insight 2', description: 'Another demo insight for stock levels.', category: 'stok', importance: 'medium', department: 'Depo', date: new Date().toISOString(), predictions: [], actions: ['Check stock levels for item X'] }
    ];
  },
  // Placeholder/Mock functions for those expected by AIAssistantPanel and AIChatModal
  getSystemData: async () => {
    defaultLogger.info('[AI Service] getSystemData called (mock implementation)');
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async
    return { 
      cadModels: [
        { id: 'rm36cb', name: 'RM 36 CB', previewImage: '/assets/images/models/rm36cb_preview.png', relatedDocs: [{id: 'doc1', name: 'RM36CB Teknik Çizim.pdf'}] },
        { id: 'rm36lb', name: 'RM 36 LB', previewImage: '/assets/images/models/rm36lb_preview.png', relatedDocs: [] }
      ],
      // Add other system data as needed
    };
  },
  modelComponents: async (modelId) => {
    defaultLogger.info(`[AI Service] modelComponents called for ${modelId} (mock implementation)`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return { 
      success: true, 
      data: { 
        components: [
          { name: 'Ana Gövde', material: 'Çelik S235JR', quantity: 1 },
          { name: 'Kesici Ünitesi', material: 'Vakum Tüpü', quantity: 3 },
          { name: 'Ayırıcı Mekanizması', material: 'Bakır Alaşım', quantity: 1 }
        ] 
      } 
    };
  },
  modelMeasurements: async (modelId) => {
    defaultLogger.info(`[AI Service] modelMeasurements called for ${modelId} (mock implementation)`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return { 
      success: true, 
      data: { 
        dimensions: { width: '1200mm', height: '2200mm', depth: '1500mm' },
        weight: '750kg'
      } 
    };
  },
  getNotesSummaryForAI: async (context) => {
    defaultLogger.info('[AI Service] getNotesSummaryForAI called (mock implementation)', context);
    await new Promise(resolve => setTimeout(resolve, 100));
    return "Bu, yapay zeka için mock not özetidir. Sipariş X ile ilgili son notlar, müşteri geri bildirimlerini ve teslimat zaman çizelgesindeki potansiyel bir gecikmeyi içermektedir.";
  },
};

// --- ÜRETİM SÜREÇ YÖNETİMİ ---
/**
 * Yeni sipariş için otomatik üretim planı ve iş emri oluşturur.
 * @param {object} order Sipariş objesi
 * @returns {Promise<object>} Oluşturulan üretim planı ve iş emirleri
 */
async function createProductionPlanForOrder(order) {
  const materials = await queryDocuments('materials');
  const requiredMaterials = (order.items || []).map(item => {
    const mat = materials.find(m => m.code === item.materialCode);
    return {
      materialCode: item.materialCode,
      name: mat ? mat.name : 'Bilinmiyor',
      requiredQty: item.quantity,
      stock: mat ? mat.stock : 0,
      criticalLevel: mat ? mat.criticalLevel : 0
    };
  });
  const maxDailyCapacity = 100;
  const totalQty = order.items ? order.items.reduce((sum, i) => sum + i.quantity, 0) : 0;
  const daysNeeded = Math.ceil(totalQty / maxDailyCapacity);
  const workOrders = [];
  let remaining = totalQty;
  for (let day = 1; day <= daysNeeded; day++) {
    const qty = Math.min(remaining, maxDailyCapacity);
    workOrders.push({
      day,
      plannedQty: qty,
      status: 'Planlandı',
      assignedTo: null
    });
    remaining -= qty;
  }
  const today = new Date();
  const milestones = workOrders.map((wo, idx) => ({
    day: wo.day,
    date: new Date(today.getTime() + idx * 24 * 60 * 60 * 1000).toISOString(),
    plannedQty: wo.plannedQty
  }));
  return {
    orderNo: order.orderNo,
    requiredMaterials,
    workOrders,
    milestones
  };
}

/**
 * Üretim ilerleme ve sapma analizini döndürür.
 * @param {string} orderNo
 * @returns {Promise<object>} İlerleme ve sapma analizi
 */
async function getProductionProgress(orderNo) {
  const workOrders = await queryDocuments('workOrders', { orderNo });
  const actuals = await queryDocuments('productionActuals', { orderNo });
  const progress = (workOrders || []).map(wo => {
    const actual = (actuals || []).find(a => a.day === wo.day);
    return {
      day: wo.day,
      plannedQty: wo.plannedQty,
      actualQty: actual ? actual.actualQty : 0,
      deviation: actual ? actual.actualQty - wo.plannedQty : -wo.plannedQty
    };
  });
  return { orderNo, progress };
}

/**
 * Boşta duran malzemeleri tespit eder.
 * @returns {Promise<Array>} Boşta duran malzeme listesi
 */
async function getIdleMaterials() {
  // Malzeme hareketleri ve üretim iş emirlerinden kullanılmayanları bul
  const materials = await queryDocuments('materials');
  const workOrders = await queryDocuments('workOrders');
  const usedMaterialCodes = new Set();
  (workOrders || []).forEach(wo => {
    (wo.items || []).forEach(item => usedMaterialCodes.add(item.materialCode));
  });
  // Son 30 günde hiç kullanılmamış olanları bul
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return (materials || []).filter(mat => {
    if (!mat.lastUsedDate) return true;
    const lastUsed = new Date(mat.lastUsedDate).getTime();
    return (now - lastUsed > THIRTY_DAYS) && !usedMaterialCodes.has(mat.code);
  });
}

/**
 * Alternatif tedarikçi önerir (kritik stok veya geciken sipariş için).
 * @param {string} materialCode
 * @returns {Promise<Array>} Alternatif tedarikçi listesi
 */
async function suggestAlternativeSuppliers(materialCode) {
  const suppliers = await queryDocuments('suppliers');
  return (suppliers || []).filter(sup => (sup.materials || []).includes(materialCode));
}

/**
 * Maliyet ve verimlilik analizleri döndürür.
 * @returns {Promise<object>} Analiz sonuçları
 */
async function getCostEfficiencyAnalysis() {
  const orders = await queryDocuments('orders');
  const materials = await queryDocuments('materials');
  // Basit örnek: son 3 ayda birim maliyet ve verimlilik trendi
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  const filteredOrders = (orders || []).filter(o => new Date(o.date) >= threeMonthsAgo);
  const totalCost = filteredOrders.reduce((sum, o) => sum + (o.totalCost || 0), 0);
  const totalQty = filteredOrders.reduce((sum, o) => sum + (o.totalQuantity || 0), 0);
  const avgUnitCost = totalQty > 0 ? totalCost / totalQty : 0;
  // Verimlilik: iş emri başına ortalama üretim süresi
  const workOrders = await queryDocuments('workOrders');
  const avgDuration = (workOrders || []).reduce((sum, wo) => sum + (wo.durationHours || 0), 0) / ((workOrders || []).length || 1);
  return { avgUnitCost, avgDuration };
}

/**
 * Tahminsel analitik: teslimat tarihi, darboğaz, kalite riski, maliyet trendi
 * @returns {Promise<object>} Tahminsel analiz sonuçları
 */
async function getPredictiveAnalytics() {
  const orders = await queryDocuments('orders');
  const workOrders = await queryDocuments('workOrders');
  // Teslimat tarihi tahmini: ortalama gecikme
  const delivered = (orders || []).filter(o => o.status === 'delivered');
  const avgDelay = delivered.length > 0 ? delivered.reduce((sum, o) => sum + ((new Date(o.actualDeliveryDate) - new Date(o.plannedDeliveryDate)) / (1000*60*60*24)), 0) / delivered.length : 0;
  // Darboğaz: en çok geciken iş emri istasyonu
  const bottlenecks = {};
  (workOrders || []).forEach(wo => {
    if (wo.delayHours > 0) {
      bottlenecks[wo.station] = (bottlenecks[wo.station] || 0) + wo.delayHours;
    }
  });
  const bottleneckStation = Object.entries(bottlenecks).sort((a,b) => b[1]-a[1])[0]?.[0] || null;
  // Kalite riski: son 3 ayda en çok hata çıkan ürün
  const qualityIssues = await queryDocuments('qualityIssues');
  const productIssueCount = {};
  (qualityIssues || []).forEach(q => {
    productIssueCount[q.productCode] = (productIssueCount[q.productCode] || 0) + 1;
  });
  const riskyProduct = Object.entries(productIssueCount).sort((a,b) => b[1]-a[1])[0]?.[0] || null;
  // Maliyet trendi: son 3 ay
  const costTrend = [];
  for (let i = 2; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthOrders = (orders || []).filter(o => new Date(o.date).getMonth() === month.getMonth());
    const monthCost = monthOrders.reduce((sum, o) => sum + (o.totalCost || 0), 0);
    costTrend.push({ month: month.toISOString().slice(0,7), totalCost: monthCost });
  }
  return { avgDelay, bottleneckStation, riskyProduct, costTrend };
}

// --- TensorFlow.js ile örnek zaman serisi tahmini ---
async function runProductionDelayForecast() {
  // Son 30 günün gecikme verisini kullan
  const delays = productionLearningState.delayTrend.map(d => d.delay);
  if (delays.length < 5) return null; // Yeterli veri yoksa tahmin yapma
  // Basit bir LSTM yerine, tek katmanlı dense model ile örnek
  const xs = tf.tensor2d(delays.slice(0, -1).map((v, i) => [i]), [delays.length - 1, 1]);
  const ys = tf.tensor2d(delays.slice(1), [delays.length - 1, 1]);
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 8, activation: 'relu', inputShape: [1] }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
  await model.fit(xs, ys, { epochs: 30, verbose: 0 });
  // Sonraki günü tahmin et
  const nextX = tf.tensor2d([[delays.length]]);
  const prediction = model.predict(nextX);
  const predictedDelay = (await prediction.data())[0];
  // Modeli state'e kaydet (örnek)
  productionLearningState.predictedNextDelay = predictedDelay;
  return predictedDelay;
}

const productionLearningState = {
  totalProduced: 0,
  totalDelayed: 0,
  totalOrders: 0,
  avgDelay: 0,
  avgQualityScore: 0,
  delayTrend: [], // Son N gün/gece ayı
  qualityTrend: [],
  lastUpdated: null,
  // Gelişmiş model için: ML weights, params, vs.
};

export async function updateProductionLearningModel(newProductionData) {
  // newProductionData: { orderNo, completedAt, plannedAt, qualityScore, isDelayed, ... }
  // 1. Temel istatistikleri güncelle
  productionLearningState.totalOrders++;
  if (newProductionData.isDelayed) {
    productionLearningState.totalDelayed++;
  }
  if (typeof newProductionData.qualityScore === 'number') {
    // Basit hareketli ortalama
    productionLearningState.avgQualityScore =
      (productionLearningState.avgQualityScore * (productionLearningState.totalOrders - 1) + newProductionData.qualityScore) /
      productionLearningState.totalOrders;
    productionLearningState.qualityTrend.push({
      date: newProductionData.completedAt,
      score: newProductionData.qualityScore,
    });
    if (productionLearningState.qualityTrend.length > 30) productionLearningState.qualityTrend.shift();
  }
  if (typeof newProductionData.delayDays === 'number') {
    productionLearningState.avgDelay =
      (productionLearningState.avgDelay * (productionLearningState.totalOrders - 1) + newProductionData.delayDays) /
      productionLearningState.totalOrders;
    productionLearningState.delayTrend.push({
      date: newProductionData.completedAt,
      delay: newProductionData.delayDays,
    });
    if (productionLearningState.delayTrend.length > 30) productionLearningState.delayTrend.shift();
  }
  productionLearningState.lastUpdated = new Date().toISOString();
  // 2. Gelişmiş ML (opsiyonel): TensorFlow.js ile zaman serisi tahmini
  await runProductionDelayForecast();
  // 3. Sonuçları cache/state olarak sakla, proaktif analiz fonksiyonları buradan okur
}

/**
 * Proaktif analiz fonksiyonları, güncel öğrenme state'ini kullanabilir.
 * Örnek: getProductionLearningSummary
 */
export function getProductionLearningSummary() {
  return { ...productionLearningState };
}