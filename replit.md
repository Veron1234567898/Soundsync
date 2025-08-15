# Soundboard Application

## Overview

A real-time collaborative soundboard application built with React, Express.js, and WebSockets. Users can create or join rooms using 6-character codes, upload audio files (MP3/WAV), and play sounds that are synchronized across all room participants. The application features a Discord-inspired dark theme UI, real-time participant management, and WebRTC-powered voice chat functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Migration Updates (Aug 15, 2025)
- **Migration Status**: Successfully migrated from Replit Agent to Replit environment
- **Database**: PostgreSQL database configured and schema deployed
- **Deployment Fix**: Resolved Vercel deployment conflicts with Railway database
- **File Conflicts**: Removed duplicate API files (`api/index.js`, `api/server.js`) causing Vercel build errors
- **Integration**: Updated API endpoints for proper Railway database connection

## Recent Migration Updates (Aug 15, 2025)
- **Migration Status**: Successfully migrated from Replit Agent to Replit environment
- **Database**: PostgreSQL database configured and schema deployed
- **Deployment Fix**: Resolved Vercel deployment conflicts with Railway database
- **File Conflicts**: Removed duplicate API files (`api/index.js`, `api/server.js`) causing Vercel build errors
- **Integration**: Updated API endpoints for proper Railway database connection

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/ui components with Radix UI primitives for accessible component foundation
- **Styling**: Tailwind CSS with custom Discord-themed color scheme and CSS variables
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: WebSocket client with automatic reconnection logic

### Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **API Design**: RESTful endpoints for CRUD operations with WebSocket integration for real-time features
- **File Upload**: Multer middleware for handling audio file uploads with type validation and size limits
- **Error Handling**: Centralized error handling middleware with structured error responses
- **Development Setup**: Vite integration for seamless full-stack development experience

### Data Storage Solutions
- **Primary Storage**: PostgreSQL database with Drizzle ORM for type-safe database operations and data persistence
- **Database Implementation**: Full DatabaseStorage class replacing in-memory storage for production reliability
- **Schema**: Three main entities - rooms, sounds, and participants with proper foreign key relationships
- **Database Features**: Automatic UUID generation, foreign key constraints, and data integrity enforcement
- **Deployment Ready**: PostgreSQL database configured and ready for Render deployment
- **File Storage**: Local filesystem storage for uploaded audio files in dedicated uploads directory

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store for persistent user sessions
- **Participant Management**: Temporary participant identification within rooms without persistent user accounts
- **Room Security**: 6-character alphanumeric room codes for room access control
- **Host Privileges**: Room creators have host status for administrative actions

### External Dependencies
- **Database**: Neon Database (serverless PostgreSQL)
- **File Upload**: Multer for multipart form data handling
- **WebSocket**: Native WebSocket implementation for real-time communication
- **Audio Processing**: Browser-native Web Audio API for client-side audio playback
- **Voice Chat**: WebRTC peer-to-peer connections with STUN servers for real-time voice communication
- **UI Components**: Radix UI primitives for accessible component foundation
- **Development Tools**: Vite with React plugin and runtime error overlay for enhanced development experience

### Real-time Voice Chat Features
- **WebRTC Implementation**: Peer-to-peer voice connections using RTCPeerConnection with Google STUN servers
- **Audio Processing**: Enhanced microphone capture with echo cancellation, noise suppression, and auto gain control
- **WebSocket Signaling**: Voice chat coordination through WebSocket messages for offer/answer exchange and ICE candidates
- **Audio Controls**: Mute/unmute functionality with real-time status broadcasting to other participants
- **Connection Management**: Automatic connection cleanup and participant status tracking