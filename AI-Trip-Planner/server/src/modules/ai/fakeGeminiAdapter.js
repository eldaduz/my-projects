function clone(value) {
  return structuredClone(value);
}

export function createFakeGeminiAdapter({
  responseText = '',
  error = null,
  generateResponseText = responseText,
  correctionResponseText = responseText,
  replanResponseText = responseText,
  generateError = error,
  correctionError = null,
  replanError = null,
  generateResponse,
  correctionResponse,
  replanResponse,
} = {}) {
  const receivedCalls = [];
  const correctionCalls = [];
  const replanCalls = [];
  const resolve = async (response, fallback, ...args) => {
    if (typeof response === 'function') return response(...args);
    return response ?? fallback;
  };
  return {
    receivedCalls,
    generateCalls: receivedCalls,
    correctionCalls,
    replanCalls,
    async generateItinerary(context) {
      receivedCalls.push(clone(context));
      if (generateError) throw generateError;
      return resolve(generateResponse, generateResponseText, context);
    },
    async correctInvalidItinerary(context, invalidOutput, validationErrors) {
      correctionCalls.push(clone({ context, invalidOutput, validationErrors }));
      if (correctionError) throw correctionError;
      return resolve(correctionResponse, correctionResponseText, context, invalidOutput, validationErrors);
    },
    async replanItinerary(context) {
      replanCalls.push(clone(context));
      if (replanError) throw replanError;
      return resolve(replanResponse, replanResponseText, context);
    },
  };
}
