/**
 * 客户端加密：AES-256-GCM，密钥由密码 + 盐经 PBKDF2 派生
 */
(function (global) {
  'use strict';

  const PBKDF2_ITERATIONS = 120000;

  function bufToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function base64ToBuf(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function randomSalt() {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    return bufToBase64(salt);
  }

  async function deriveKey(password, saltBase64) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: base64ToBuf(saltBase64),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptJson(data, password, saltBase64) {
    const key = await deriveKey(password, saltBase64);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(data));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
    return JSON.stringify({
      v: 1,
      iv: bufToBase64(iv),
      data: bufToBase64(cipher),
    });
  }

  async function decryptJson(payload, password, saltBase64) {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!parsed || parsed.v !== 1 || !parsed.iv || !parsed.data) {
      throw new Error('INVALID_PAYLOAD');
    }
    const key = await deriveKey(password, saltBase64);
    const iv = new Uint8Array(base64ToBuf(parsed.iv));
    const cipher = base64ToBuf(parsed.data);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  global.BabyBookCrypto = {
    randomSalt,
    encryptJson,
    decryptJson,
  };
})(window);
