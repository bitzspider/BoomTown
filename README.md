# BoomTown

A fast-paced 3D first-person shooter game built with Babylon.js, featuring a powerful map editor and model viewer. Create your own battlegrounds, test different weapons, and engage in intense combat scenarios.

## 🎮 Game Features

### First Person Shooter
- Fast-paced combat mechanics
- Multiple character types (Soldier, Hazmat, Enemy)
- Diverse weapon arsenal (Sniper, Pistol, Rocket Launcher, etc.)
- Character movement and combat physics
- Real-time hit detection and damage system

### Map Editor
- Intuitive drag-and-drop interface
- Real-time 3D object placement and manipulation
- Precise position and rotation controls
- Grid system for accurate object placement
- Map saving and loading functionality
- Auto-backup system to prevent data loss

### Model Viewer
- Preview all game models in 3D
- Detailed model inspection
- Category-based model organization
- High-quality model previews

## 🎯 Controls

### Game Controls
- **WASD**: Character movement
- **Mouse**: Look around/Aim
- **Left Click**: Shoot
- **Space**: Jump
- **Shift**: Sprint
- **R**: Reload

### Map Editor Controls
- **Left Click**: Select/Place objects
- **Arrow Keys**: Move selected object
- **Shift + Arrow Keys**: Rotate selected object
- **Delete**: Remove selected object
- **Ctrl + Arrow Keys**: Fine movement control (0.1 units)
- **Mouse Wheel**: Zoom camera
- **Right Mouse Button**: Orbit camera

## 🛠️ Technical Stack

- **Frontend**:
  - Babylon.js for 3D rendering and physics
  - HTML5/CSS3/JavaScript
  - Custom UI components
  - WebGL for hardware acceleration

- **Backend**:
  - Node.js
  - Express.js
  - File-based data storage
  - Real-time map data synchronization

## 📦 Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/bitzspider/BoomTown.git
   cd BoomTown
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start the Server**
   ```bash
   node server.js
   ```

4. **Access the Game**
   - Open your browser and navigate to `http://localhost:3000`
   - For the map editor, go to `http://localhost:3000/Demos/World_Maps.html`
   - For the model viewer, go to `http://localhost:3000/Demos/Model_Viewer.html`

## 📁 Project Structure

```
BoomTown/
├── public/
│   ├── Demos/           # Main application files
│   │   ├── js/         # Game logic and controllers
│   │   └── backups/    # Map backups
│   ├── models/         # 3D model files (.glb)
│   ├── img/           # Model preview images
│   └── js/            # Shared JavaScript files
├── server.js          # Backend server
└── package.json       # Project dependencies
```

## 🎨 Features in Development

- Multiplayer support
- Additional weapons and characters
- Advanced particle effects
- Custom map sharing
- Enhanced lighting and shadows
- More environmental objects
- Advanced AI behaviors

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- 3D models from Poly Pizza
- Babylon.js community
- Contributors and testers

## 🐛 Known Issues

- Report any bugs in the Issues section
- Check existing issues before creating a new one 