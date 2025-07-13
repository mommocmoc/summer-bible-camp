# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web application for taking verification photos with chef hat and apron overlays using face/body recognition. Built for summer bible camp activities, it allows users to take photos with costume overlays applied in real-time.

## Technology Stack

- **P5.js**: Main graphics and interaction library
- **ML5.js v1.2.1**: Machine learning library for body pose detection (uses MoveNet model)
- **Vanilla HTML/CSS/JavaScript**: Core web technologies
- **MediaDevices API**: Camera access and controls

## Key Requirements

### Camera Support
- Desktop: Laptop camera as primary
- Mobile: Front camera as primary, rear camera support required
- Camera switching functionality needed

### Core Features
- Real-time face/body detection and overlay positioning
- Chef hat and apron image overlays
- Photo capture and save functionality
- Responsive design (desktop-first, mobile-compatible)
- Real-time preview with background image elements

### Development Approach
- Start simple and iterate
- Modular image asset system for easy additions/modifications
- Responsive design with desktop priority

## Development Commands

Since this is a client-side web application:
- **Development server**: Use any local server (e.g., `python -m http.server 8000`, Live Server extension)
- **Testing**: Open in browser and test camera functionality
- **Mobile testing**: Use browser dev tools device simulation or deploy to test on actual devices

## Architecture Notes

### File Structure
- `index.html`: Main application entry point
- `style.css`: Responsive styles
- `script.js`: Main application logic with P5.js and ML5.js
- `assets/`: Image assets for overlays (chef hat, apron, backgrounds)

### Key Components
- Camera initialization and device selection
- Face/body detection using ML5.js
- Overlay positioning and rendering
- Photo capture and download functionality
- Responsive layout management

## Camera Integration Notes

- Use `navigator.mediaDevices.getUserMedia()` for camera access
- Implement device enumeration for camera switching
- Handle permissions and error states gracefully
- Ensure proper cleanup of media streams

## ML5.js Integration

- **Model**: ML5.js v1.2.1 with MoveNet bodyPose (SINGLEPOSE_THUNDER)
- **API**: Use `ml5.bodyPose()` instead of deprecated `ml5.poseNet()`
- **Keypoints**: Access pose data via `pose.keypoints` with `name` and `confidence` properties
- **Key landmarks**: 'nose', 'left_shoulder', 'right_shoulder' for overlay positioning
- Handle cases where no body is detected (confidence < 0.3)
- Optimize for real-time performance with smoothing enabled