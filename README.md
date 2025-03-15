# Map Viewer / Designer

A web-based 3D map viewer and designer built with Babylon.js. This tool allows users to create, edit, and save 3D maps with various objects and models.

## Features

- 3D map viewing and editing
- Object placement with drag and drop
- Object manipulation (move, rotate)
- Grid system for precise placement
- Save/Load map functionality
- Model categorization
- Real-time position and rotation updates
- Object deletion with confirmation

## Controls

- **Left Click**: Select objects
- **Arrow Keys**: Move selected object
- **Shift + Arrow Keys**: Rotate selected object
- **Delete**: Remove selected object (with confirmation)

## Technical Stack

- Babylon.js for 3D rendering
- Node.js backend
- Express.js for server
- HTML5/CSS3/JavaScript
- Grid Material for ground visualization

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node server.js
   ```
4. Open your browser and navigate to `http://localhost:3000`

## Project Structure

- `/public` - Static files
  - `/Demos` - Main application files
  - `/models` - 3D model files
  - `/icons` - UI icons
- `/server.js` - Backend server 