export const validateToken = (token: string): boolean => {
  if (!token) return false;
  
  // Check if token contains only ASCII characters
  const isAscii = /^[\x00-\x7F]*$/.test(token);
  if (!isAscii) {
    console.error('❌ Token contains non-ASCII characters');
    return false;
  }
  
  // Check token structure (basic JWT validation)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.error('❌ Invalid JWT token structure');
    return false;
  }
  
  try {
    // Try to decode the payload
    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      console.error('❌ Token has expired');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to parse token payload:', error);
    return false;
  }
};

export const cleanToken = (token: string): string => {
  return token.replace(/[^\x00-\x7F]/g, '').trim();
};

export const getStoredToken = (): string | null => {
  const token = localStorage.getItem('authToken');
  if (!token) return null;
  
  const cleanedToken = cleanToken(token);
  if (cleanedToken !== token) {
    console.warn('⚠️ Token contained non-ASCII characters, cleaned');
    localStorage.setItem('authToken', cleanedToken);
  }
  
  return validateToken(cleanedToken) ? cleanedToken : null;
};