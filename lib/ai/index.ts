/**
 * AI Module - Central exports for the Agentic Factory AI system
 *
 * This module provides:
 * - Genkit AI configuration with Gemini models
 * - AI tools for file operations, shell commands, etc.
 * - Types for chat messages, tool calls, file operations
 * - Streaming response utilities
 * - Conversation context management
 * - Prompt router for intent classification (coming in Module 8)
 */

// Core Genkit configuration and models
export * from './genkit';

// AI Tools for WebContainer operations
export * from './tools';

// Type definitions
export * from './types';

// Streaming utilities
export * from './streaming';

// Context management
export * from './context';

// Agent system
export * from './agents';

// Prompt router
export * from './router';

// Governance system
export * from './governance';

// Quality gates
export * from './quality';

// Error handling
export * from './errors';

// Response caching
export * from './cache';

// Request queuing
export * from './queue';

// Parallel execution
export * from './execution';

// Token optimization
export * from './optimization';
